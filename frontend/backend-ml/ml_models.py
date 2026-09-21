"""
Forecasting models: XGBoost (Gradient Boosted Trees with Technical Indicators),
ARIMA, Prophet (classical), and LSTM (deep learning).
Also produces an up/down direction classifier with XGBoost.
All models are trained fresh per-request on the fetched history.
"""
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")


def _prep_series(prices: list) -> pd.DataFrame:
    df = pd.DataFrame(prices)
    df["date"] = pd.to_datetime(df["date"])
    if df["date"].dt.tz is not None:
        df["date"] = df["date"].dt.tz_localize(None)
    df = df.sort_values("date").reset_index(drop=True)
    return df


def forecast_xgboost(prices: list, horizon: int = 15) -> dict:
    """High-accuracy gradient boosted tree forecaster using engineered technical indicators."""
    try:
        import xgboost as xgb

        df = _prep_series(prices)
        if len(df) < 35:
            return {"model": "XGBoost", "error": "not enough data (need at least 35 days)", "forecast": []}

        close = df["close"]
        df["ret_1d"] = close.pct_change()
        df["ret_3d"] = close.pct_change(3)
        df["ret_5d"] = close.pct_change(5)
        df["ma5_ratio"] = close.rolling(5).mean() / close - 1
        df["ma20_ratio"] = close.rolling(20).mean() / close - 1
        df["vol_change"] = df["volume"].pct_change()

        # RSI (14-day)
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / (loss + 1e-9)
        df["rsi"] = 100 - (100 / (1 + rs))

        # MACD (12/26)
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        df["macd"] = (ema12 - ema26) / close

        # Volatility (10-day rolling return std)
        df["volatility_10"] = df["ret_1d"].rolling(10).std()

        # Target: next-day return
        df["target_return"] = close.shift(-1) / close - 1

        features = [
            "ret_1d", "ret_3d", "ret_5d", "ma5_ratio", "ma20_ratio",
            "vol_change", "rsi", "macd", "volatility_10"
        ]
        df[features] = df[features].replace([np.inf, -np.inf], np.nan)
        df_clean = df.dropna(subset=features + ["target_return"])

        if len(df_clean) < 25:
            return {"model": "XGBoost", "error": "not enough clean data", "forecast": []}

        X = df_clean[features].values
        y = df_clean["target_return"].values

        model = xgb.XGBRegressor(n_estimators=120, max_depth=3, learning_rate=0.05, random_state=42, n_jobs=1)
        model.fit(X, y)

        # Calculate residual uncertainty for 80% confidence interval band
        in_sample_preds = model.predict(X)
        resid_std = float(np.std(y - in_sample_preds))
        last_vol = float(df_clean["volatility_10"].iloc[-1])
        step_uncertainty = max(resid_std, last_vol if not np.isnan(last_vol) else 0.01)

        # Multi-step forward recursive forecasting
        current_prices = list(close.values)
        current_volumes = list(df["volume"].values)
        preds = []

        for _ in range(horizon):
            s = pd.Series(current_prices)
            v = pd.Series(current_volumes)
            c = s.iloc[-1]

            r1 = (c - s.iloc[-2]) / s.iloc[-2] if len(s) > 1 else 0
            r3 = (c - s.iloc[-4]) / s.iloc[-4] if len(s) > 3 else r1
            r5 = (c - s.iloc[-6]) / s.iloc[-6] if len(s) > 5 else r3
            m5 = (s.iloc[-5:].mean() / c - 1) if len(s) >= 5 else 0
            m20 = (s.iloc[-20:].mean() / c - 1) if len(s) >= 20 else 0
            vc = (v.iloc[-1] - v.iloc[-2]) / (v.iloc[-2] + 1) if len(v) > 1 else 0

            diffs = s.diff()
            g = diffs.clip(lower=0).iloc[-14:].mean() if len(s) >= 14 else 0
            l = (-diffs.clip(upper=0)).iloc[-14:].mean() if len(s) >= 14 else 0
            rsi_val = 100 - (100 / (1 + (g / (l + 1e-9))))

            ema_12 = s.ewm(span=12, adjust=False).mean().iloc[-1]
            ema_26 = s.ewm(span=26, adjust=False).mean().iloc[-1]
            macd_val = (ema_12 - ema_26) / c

            vol10 = s.pct_change().iloc[-10:].std()
            vol10 = vol10 if not np.isnan(vol10) else 0.01

            feat_vec = np.array([[r1, r3, r5, m5, m20, vc, rsi_val, macd_val, vol10]])
            pred_return = float(model.predict(feat_vec)[0])
            pred_return = np.clip(pred_return, -0.06, 0.06)
            next_close = c * (1 + pred_return)

            preds.append(next_close)
            current_prices.append(next_close)
            current_volumes.append(current_volumes[-1])

        last_date = df["date"].iloc[-1]
        future_dates = pd.bdate_range(last_date, periods=horizon + 1)[1:]

        return {
            "model": "XGBoost",
            "forecast": [
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "predicted": round(float(preds[i]), 2),
                    "lower": round(float(preds[i] * (1 - 1.28 * step_uncertainty * np.sqrt(i + 1))), 2),
                    "upper": round(float(preds[i] * (1 + 1.28 * step_uncertainty * np.sqrt(i + 1))), 2),
                }
                for i, d in enumerate(future_dates)
            ],
        }
    except Exception as e:
        return {"model": "XGBoost", "error": str(e), "forecast": []}


def forecast_arima(prices: list, horizon: int = 15) -> dict:
    try:
        from statsmodels.tsa.arima.model import ARIMA

        df = _prep_series(prices)
        series = df["close"].values

        model = ARIMA(series, order=(5, 1, 0))
        fit = model.fit()
        forecast_res = fit.get_forecast(steps=horizon)
        mean = forecast_res.predicted_mean
        conf = forecast_res.conf_int(alpha=0.2)  # 80% band
        last_date = df["date"].iloc[-1]
        future_dates = pd.bdate_range(last_date, periods=horizon + 1)[1:]

        return {
            "model": "ARIMA",
            "forecast": [
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "predicted": round(float(mean[i]), 2),
                    "lower": round(float(conf[i][0]), 2),
                    "upper": round(float(conf[i][1]), 2),
                }
                for i, d in enumerate(future_dates)
            ],
        }
    except Exception as e:
        return {"model": "ARIMA", "error": str(e), "forecast": []}


def forecast_prophet(prices: list, horizon: int = 15) -> dict:
    try:
        from prophet import Prophet

        df = _prep_series(prices)
        prophet_df = df[["date", "close"]].rename(columns={"date": "ds", "close": "y"})

        m = Prophet(daily_seasonality=False, weekly_seasonality=True, yearly_seasonality=True,
                    interval_width=0.8)
        m.fit(prophet_df)
        future = m.make_future_dataframe(periods=horizon, freq="B")
        fcst = m.predict(future)
        tail = fcst.tail(horizon)

        return {
            "model": "Prophet",
            "forecast": [
                {
                    "date": row["ds"].strftime("%Y-%m-%d"),
                    "predicted": round(float(row["yhat"]), 2),
                    "lower": round(float(row["yhat_lower"]), 2),
                    "upper": round(float(row["yhat_upper"]), 2),
                }
                for _, row in tail.iterrows()
            ],
        }
    except Exception as e:
        return {"model": "Prophet", "error": str(e), "forecast": []}


def forecast_lstm(prices: list, horizon: int = 15, lookback: int = 30) -> dict:
    """A robust LSTM forecaster. Uses PyTorch if TensorFlow is not available."""
    # First attempt TensorFlow (as in main-backend)
    try:
        import tensorflow as tf
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense
        from sklearn.preprocessing import MinMaxScaler

        df = _prep_series(prices)
        close = df["close"].values.reshape(-1, 1)

        if len(close) < lookback + 10:
            return {"model": "LSTM", "error": "not enough data", "forecast": []}

        scaler = MinMaxScaler()
        scaled = scaler.fit_transform(close)

        X, y = [], []
        for i in range(lookback, len(scaled)):
            X.append(scaled[i - lookback:i, 0])
            y.append(scaled[i, 0])
        X, y = np.array(X), np.array(y)
        X = X.reshape((X.shape[0], X.shape[1], 1))

        model = Sequential([
            LSTM(50, return_sequences=True, input_shape=(lookback, 1)),
            LSTM(50),
            Dense(1),
        ])
        model.compile(optimizer="adam", loss="mse")
        model.fit(X, y, epochs=15, batch_size=16, verbose=0)

        last_window = scaled[-lookback:].reshape(1, lookback, 1)
        preds_scaled = []
        window = last_window.copy()
        for _ in range(horizon):
            pred = model.predict(window, verbose=0)[0, 0]
            preds_scaled.append(pred)
            window = np.append(window[:, 1:, :], [[[pred]]], axis=1)

        preds = scaler.inverse_transform(np.array(preds_scaled).reshape(-1, 1)).flatten()

        train_preds = model.predict(X, verbose=0).flatten()
        resid_std = float(np.std(scaler.inverse_transform(train_preds.reshape(-1,1)).flatten()
                                  - scaler.inverse_transform(y.reshape(-1,1)).flatten()))

        last_date = df["date"].iloc[-1]
        future_dates = pd.bdate_range(last_date, periods=horizon + 1)[1:]

        return {
            "model": "LSTM",
            "forecast": [
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "predicted": round(float(preds[i]), 2),
                    "lower": round(float(preds[i] - 1.28 * resid_std), 2),
                    "upper": round(float(preds[i] + 1.28 * resid_std), 2),
                }
                for i, d in enumerate(future_dates)
            ],
        }
    except Exception:
        # Fallback to PyTorch LSTM
        try:
            import torch
            import torch.nn as nn

            df = _prep_series(prices)
            close = df["close"].values.astype(np.float32)
            eff_lookback = min(lookback, max(10, len(close) // 4))

            if len(close) < eff_lookback + 10:
                return {"model": "LSTM", "error": "not enough data", "forecast": []}

            mean_p = float(close.mean())
            std_p = float(close.std() + 1e-6)
            norm = (close - mean_p) / std_p

            X, y = [], []
            for i in range(eff_lookback, len(norm)):
                X.append(norm[i - eff_lookback:i])
                y.append(norm[i])
            X_t = torch.tensor(np.array(X), dtype=torch.float32).unsqueeze(-1)
            y_t = torch.tensor(np.array(y), dtype=torch.float32).unsqueeze(-1)

            class TorchLSTM(nn.Module):
                def __init__(self):
                    super().__init__()
                    self.lstm = nn.LSTM(1, 32, batch_first=True)
                    self.fc = nn.Linear(32, 1)

                def forward(self, x):
                    out, _ = self.lstm(x)
                    return self.fc(out[:, -1, :])

            net = TorchLSTM()
            optimizer = torch.optim.Adam(net.parameters(), lr=0.03)
            criterion = nn.MSELoss()

            for _ in range(12):
                optimizer.zero_grad()
                pred = net(X_t)
                loss = criterion(pred, y_t)
                loss.backward()
                optimizer.step()

            net.eval()
            curr_window = list(norm[-eff_lookback:])
            preds_norm = []
            with torch.no_grad():
                for _ in range(horizon):
                    inp = torch.tensor(np.array(curr_window), dtype=torch.float32).view(1, eff_lookback, 1)
                    p_next = float(net(inp).item())
                    preds_norm.append(p_next)
                    curr_window = curr_window[1:] + [p_next]

            preds = np.array(preds_norm) * std_p + mean_p
            last_date = df["date"].iloc[-1]
            future_dates = pd.bdate_range(last_date, periods=horizon + 1)[1:]

            return {
                "model": "LSTM",
                "forecast": [
                    {
                        "date": d.strftime("%Y-%m-%d"),
                        "predicted": round(float(preds[i]), 2),
                        "lower": round(float(preds[i] * (1 - 0.018 * np.sqrt(i + 1))), 2),
                        "upper": round(float(preds[i] * (1 + 0.018 * np.sqrt(i + 1))), 2),
                    }
                    for i, d in enumerate(future_dates)
                ],
            }
        except Exception as e2:
            return {"model": "LSTM", "error": str(e2), "forecast": []}


def forecast_lightgbm(prices: list, horizon: int = 15) -> dict:
    """LightGBM 4.7.0 (Fast Leaf-wise Gradient Boosting)."""
    try:
        import lightgbm as lgb
        df = _prep_series(prices)
        if len(df) < 35:
            return {"model": "LightGBM", "error": "not enough data", "forecast": []}

        close = df["close"]
        df["ret_1d"] = close.pct_change()
        df["ret_3d"] = close.pct_change(3)
        df["ret_5d"] = close.pct_change(5)
        df["ma5_ratio"] = close.rolling(5).mean() / close - 1
        df["ma20_ratio"] = close.rolling(20).mean() / close - 1
        df["vol_change"] = df["volume"].pct_change()

        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / (loss + 1e-9)
        df["rsi"] = 100 - (100 / (1 + rs))

        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        df["macd"] = (ema12 - ema26) / close
        df["volatility_10"] = df["ret_1d"].rolling(10).std()
        df["target_return"] = close.shift(-1) / close - 1

        features = ["ret_1d", "ret_3d", "ret_5d", "ma5_ratio", "ma20_ratio", "vol_change", "rsi", "macd", "volatility_10"]
        df[features] = df[features].replace([np.inf, -np.inf], np.nan)
        df_clean = df.dropna(subset=features + ["target_return"])

        if len(df_clean) < 25:
            return {"model": "LightGBM", "error": "not enough clean data", "forecast": []}

        X = df_clean[features].values
        y = df_clean["target_return"].values

        model = lgb.LGBMRegressor(n_estimators=80, max_depth=3, learning_rate=0.05, random_state=42, verbosity=-1, n_jobs=1)
        model.fit(X, y)

        current_prices = list(close.values)
        current_volumes = list(df["volume"].values)
        preds = []

        for _ in range(horizon):
            s = pd.Series(current_prices)
            v = pd.Series(current_volumes)
            c = s.iloc[-1]

            r1 = (c - s.iloc[-2]) / s.iloc[-2] if len(s) > 1 else 0
            r3 = (c - s.iloc[-4]) / s.iloc[-4] if len(s) > 3 else r1
            r5 = (c - s.iloc[-6]) / s.iloc[-6] if len(s) > 5 else r3
            m5 = (s.iloc[-5:].mean() / c - 1) if len(s) >= 5 else 0
            m20 = (s.iloc[-20:].mean() / c - 1) if len(s) >= 20 else 0
            vc = (v.iloc[-1] - v.iloc[-2]) / (v.iloc[-2] + 1) if len(v) > 1 else 0

            diffs = s.diff()
            g = diffs.clip(lower=0).iloc[-14:].mean() if len(s) >= 14 else 0
            l = (-diffs.clip(upper=0)).iloc[-14:].mean() if len(s) >= 14 else 0
            rsi_val = 100 - (100 / (1 + (g / (l + 1e-9))))

            ema_12 = s.ewm(span=12, adjust=False).mean().iloc[-1]
            ema_26 = s.ewm(span=26, adjust=False).mean().iloc[-1]
            macd_val = (ema_12 - ema_26) / c
            vol10 = s.pct_change().iloc[-10:].std()
            vol10 = vol10 if not np.isnan(vol10) else 0.01

            feat_vec = np.array([[r1, r3, r5, m5, m20, vc, rsi_val, macd_val, vol10]])
            pred_return = float(model.predict(feat_vec)[0])
            pred_return = np.clip(pred_return, -0.06, 0.06)
            next_close = c * (1 + pred_return)

            preds.append(next_close)
            current_prices.append(next_close)
            current_volumes.append(current_volumes[-1])

        last_date = df["date"].iloc[-1]
        future_dates = pd.bdate_range(last_date, periods=horizon + 1)[1:]

        return {
            "model": "LightGBM",
            "forecast": [
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "predicted": round(float(preds[i]), 2),
                    "lower": round(float(preds[i] * (1 - 0.016 * np.sqrt(i + 1))), 2),
                    "upper": round(float(preds[i] * (1 + 0.016 * np.sqrt(i + 1))), 2),
                }
                for i, d in enumerate(future_dates)
            ],
        }
    except Exception as e:
        return {"model": "LightGBM", "error": str(e), "forecast": []}


def forecast_catboost(prices: list, horizon: int = 15) -> dict:
    """CatBoost 1.2.10 (Robust Symmetric Decision Trees)."""
    try:
        import catboost as cb
        df = _prep_series(prices)
        if len(df) < 35:
            return {"model": "CatBoost", "error": "not enough data", "forecast": []}

        close = df["close"]
        df["ret_1d"] = close.pct_change()
        df["ret_3d"] = close.pct_change(3)
        df["ret_5d"] = close.pct_change(5)
        df["ma5_ratio"] = close.rolling(5).mean() / close - 1
        df["ma20_ratio"] = close.rolling(20).mean() / close - 1
        df["vol_change"] = df["volume"].pct_change()

        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / (loss + 1e-9)
        df["rsi"] = 100 - (100 / (1 + rs))

        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        df["macd"] = (ema12 - ema26) / close
        df["volatility_10"] = df["ret_1d"].rolling(10).std()
        df["target_return"] = close.shift(-1) / close - 1

        features = ["ret_1d", "ret_3d", "ret_5d", "ma5_ratio", "ma20_ratio", "vol_change", "rsi", "macd", "volatility_10"]
        df[features] = df[features].replace([np.inf, -np.inf], np.nan)
        df_clean = df.dropna(subset=features + ["target_return"])

        if len(df_clean) < 25:
            return {"model": "CatBoost", "error": "not enough clean data", "forecast": []}

        X = df_clean[features].values
        y = df_clean["target_return"].values

        model = cb.CatBoostRegressor(iterations=60, depth=4, learning_rate=0.05, random_seed=42, verbose=0, thread_count=1)
        model.fit(X, y)

        current_prices = list(close.values)
        current_volumes = list(df["volume"].values)
        preds = []

        for _ in range(horizon):
            s = pd.Series(current_prices)
            v = pd.Series(current_volumes)
            c = s.iloc[-1]

            r1 = (c - s.iloc[-2]) / s.iloc[-2] if len(s) > 1 else 0
            r3 = (c - s.iloc[-4]) / s.iloc[-4] if len(s) > 3 else r1
            r5 = (c - s.iloc[-6]) / s.iloc[-6] if len(s) > 5 else r3
            m5 = (s.iloc[-5:].mean() / c - 1) if len(s) >= 5 else 0
            m20 = (s.iloc[-20:].mean() / c - 1) if len(s) >= 20 else 0
            vc = (v.iloc[-1] - v.iloc[-2]) / (v.iloc[-2] + 1) if len(v) > 1 else 0

            diffs = s.diff()
            g = diffs.clip(lower=0).iloc[-14:].mean() if len(s) >= 14 else 0
            l = (-diffs.clip(upper=0)).iloc[-14:].mean() if len(s) >= 14 else 0
            rsi_val = 100 - (100 / (1 + (g / (l + 1e-9))))

            ema_12 = s.ewm(span=12, adjust=False).mean().iloc[-1]
            ema_26 = s.ewm(span=26, adjust=False).mean().iloc[-1]
            macd_val = (ema_12 - ema_26) / c
            vol10 = s.pct_change().iloc[-10:].std()
            vol10 = vol10 if not np.isnan(vol10) else 0.01

            feat_vec = np.array([[r1, r3, r5, m5, m20, vc, rsi_val, macd_val, vol10]])
            pred_return = float(model.predict(feat_vec)[0])
            pred_return = np.clip(pred_return, -0.06, 0.06)
            next_close = c * (1 + pred_return)

            preds.append(next_close)
            current_prices.append(next_close)
            current_volumes.append(current_volumes[-1])

        last_date = df["date"].iloc[-1]
        future_dates = pd.bdate_range(last_date, periods=horizon + 1)[1:]

        return {
            "model": "CatBoost",
            "forecast": [
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "predicted": round(float(preds[i]), 2),
                    "lower": round(float(preds[i] * (1 - 0.016 * np.sqrt(i + 1))), 2),
                    "upper": round(float(preds[i] * (1 + 0.016 * np.sqrt(i + 1))), 2),
                }
                for i, d in enumerate(future_dates)
            ],
        }
    except Exception as e:
        return {"model": "CatBoost", "error": str(e), "forecast": []}


def predict_direction(prices: list) -> dict:
    """Enhanced direction classifier: predicts next-day up/down using XGBoost on technical indicators."""
    try:
        import xgboost as xgb

        df = _prep_series(prices)
        close = df["close"]
        df["return_1d"] = close.pct_change()
        df["return_5d"] = close.pct_change(5)
        df["ma5"] = close.rolling(5).mean() / close - 1
        df["ma20"] = close.rolling(20).mean() / close - 1
        df["vol_change"] = df["volume"].pct_change()

        # RSI
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / (loss + 1e-9)
        df["rsi"] = 100 - (100 / (1 + rs))

        # MACD
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        df["macd"] = (ema12 - ema26) / close

        df["target"] = (close.shift(-1) > close).astype(int)

        features = ["return_1d", "return_5d", "ma5", "ma20", "vol_change", "rsi", "macd"]
        df[features] = df[features].replace([np.inf, -np.inf], np.nan)
        df_clean = df.dropna(subset=features + ["target"])

        if len(df_clean) < 30:
            return {"direction": "unknown", "confidence": 0.0, "error": "not enough data"}

        X = df_clean[features].values
        y = df_clean["target"].values

        split = int(len(X) * 0.85)
        X_train, y_train = X[:split], y[:split]

        clf = xgb.XGBClassifier(n_estimators=150, max_depth=3, learning_rate=0.05, random_state=42, eval_metric="logloss", n_jobs=1)
        clf.fit(X_train, y_train)

        # backtest accuracy on held-out portion
        X_test, y_test = X[split:], y[split:]
        test_acc = float(clf.score(X_test, y_test)) if len(X_test) > 0 else None

        latest_df = df[features].replace([np.inf, -np.inf], np.nan).dropna()
        if latest_df.empty:
            return {"direction": "unknown", "confidence": 0.0, "error": "insufficient clean data"}
        latest_features = latest_df.iloc[-1:].values
        proba = clf.predict_proba(latest_features)[0]
        pred = clf.predict(latest_features)[0]

        return {
            "model": "XGBoost Classifier",
            "direction": "up" if pred == 1 else "down",
            "confidence": round(float(max(proba)), 3),
            "backtest_accuracy": round(test_acc, 3) if test_acc is not None else None,
            "feature_importance": {
                f: round(float(imp), 3) for f, imp in zip(features, clf.feature_importances_)
            },
        }
    except Exception as e:
        return {"direction": "unknown", "confidence": 0.0, "error": str(e)}


def run_all_forecasts(prices: list, horizon: int = 15) -> dict:
    xgb_fc = forecast_xgboost(prices, horizon)
    lgb_fc = forecast_lightgbm(prices, horizon)
    cat_fc = forecast_catboost(prices, horizon)
    arima = forecast_arima(prices, horizon)
    prophet = forecast_prophet(prices, horizon)
    lstm = forecast_lstm(prices, horizon)
    direction = predict_direction(prices)

    return {
        "xgboost": xgb_fc,
        "lightgbm": lgb_fc,
        "catboost": cat_fc,
        "arima": arima,
        "prophet": prophet,
        "lstm": lstm,
        "direction": direction,
    }
