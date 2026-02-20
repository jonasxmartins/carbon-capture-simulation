import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def simulate_sensor(
    n_readings: int,
    base_value: float,
    noise_std: float,
    dropout_rate: float,
    tag_name: str,
    unit: str,
    start_time: datetime,
    interval_seconds: int = 5
) -> pd.DataFrame:
    """
    Simulates a single industrial sensor's time-series output.
    Injects random dropouts to mimic real sensor failures.
    """
    timestamps = [
        start_time + timedelta(seconds=interval_seconds * i)
        for i in range(n_readings)
    ]

    values = base_value + np.random.normal(0, noise_std, n_readings)
    values = np.clip(values, 0, None)  # physical values can't be negative

    # inject dropouts
    quality = ['GOOD'] * n_readings
    dropout_indices = np.random.choice(
        n_readings,
        size=int(n_readings * dropout_rate),
        replace=False
    )
    for i in dropout_indices:
        values[i] = 0.0
        quality[i] = 'BAD'

    return pd.DataFrame({
        'timestamp': timestamps,
        'tag': tag_name,
        'value': values,
        'unit': unit,
        'quality': quality
    })


def simulate_facility(n_readings: int = 720) -> pd.DataFrame:
    """
    Simulates all sensors across the facility for a given number of readings.
    720 readings at 5s intervals = 1 hour of data.
    """
    start = datetime(2024, 1, 1, 0, 0, 0)

    sensors = [
        # Node 1: Capture Unit
        simulate_sensor(n_readings, base_value=150.0, noise_std=4.0,
                       dropout_rate=0.03, tag_name='CAPTURE_CO2_FLOW',
                       unit='kg/hr', start_time=start),

        simulate_sensor(n_readings, base_value=88.5, noise_std=1.0,
                       dropout_rate=0.01, tag_name='CAPTURE_EFFICIENCY_PCT',
                       unit='%', start_time=start),

        simulate_sensor(n_readings, base_value=285.0, noise_std=1.5,
                       dropout_rate=0.01, tag_name='CAPTURE_TEMP',
                       unit='kelvin', start_time=start),

        # Node 2: Compression & Transport
        simulate_sensor(n_readings, base_value=2.4, noise_std=0.05,
                       dropout_rate=0.02, tag_name='COMPRESS_PRESSURE',
                       unit='bar', start_time=start),

        simulate_sensor(n_readings, base_value=1.8, noise_std=0.1,
                       dropout_rate=0.02, tag_name='COMPRESS_LEAKAGE_RATE',
                       unit='kg/hr', start_time=start),
    ]

    return pd.concat(sensors, ignore_index=True)