import pandas as pd
import numpy as np

class GapFillingStrategy:
    """Base class — all strategies must implement fill()"""
    def fill(self, series, metadata): raise NotImplementedError
    def audit_log(self): raise NotImplementedError  # must be reportable

class EPASubpartRR(GapFillingStrategy):
    """
    EPA approach: facility-specific, pre-approved method.
    Must count and report every substitution instance.
    Conservative default: use 90-day rolling average of valid readings.
    """
    def __init__(self):
        self.substitution_count = 0

    def fill(self, series, metadata):
        self.substitution_count = series.isna().sum()
        # Ensure we don't try to compute rolling mean on entirely empty series
        if self.substitution_count == len(series):
            return series.fillna(0)
        return series.fillna(series.rolling(window=90*24*12, min_periods=1).mean())

    def audit_log(self):
        return {"strategy": "EPA Subpart RR", "substitutions": int(self.substitution_count)}

class AlbertaTIER(GapFillingStrategy):
    """
    Alberta approach: prescribed method per level classification.
    Level 1/2: use emission factors (no sensor interpolation allowed)
    Level 3: direct measurement — gaps require formal deviation request
    Flag gaps rather than fill; treat as pending deviation approval.
    """
    def __init__(self):
        self.requires_deviation = False

    def fill(self, series, metadata):
        level = metadata.get('tier_level', 3)
        if level == 3:
            # Can't fill — must file deviation. Flag for human review.
            flagged = series.copy()
            # In pandas, None in numeric series becomes NaN anyway, but we keep the logic
            flagged[flagged.isna()] = np.nan 
            self.requires_deviation = bool(flagged.isna().any())
            return flagged
        else:
            # Use prescribed emission factor
            ef = metadata.get('emission_factor', 0)
            return series.fillna(ef)
            
    def audit_log(self):
        return {"strategy": "Alberta TIER", "requires_deviation": self.requires_deviation}

class CaliforniaLCFS(GapFillingStrategy):
    """
    LCFS approach: completeness-first.
    Credits simply not issued for periods with gaps.
    Zero-fill is the conservative interpretation.
    Verification body will reject incomplete periods.
    """
    def __init__(self):
        self.incomplete_periods = 0

    def fill(self, series, metadata):
        self.incomplete_periods = series.isna().sum()
        return series.fillna(0)  # no data = no credit for that period
        
    def audit_log(self):
        return {"strategy": "California LCFS", "incomplete_periods": int(self.incomplete_periods)}

class PuroBiochar(GapFillingStrategy):
    """
    Puro biochar methodology:
    Short gaps (<4hrs): linear interpolation between last good / next good reading
    Long gaps (>4hrs): conservative substitution = 10th percentile of last 30 days
    Must flag all substitutions in verification report.
    """
    def __init__(self):
        self.substitution_count = 0

    def fill(self, series, metadata):
        SHORT_GAP_HOURS = 4
        interval_minutes = metadata.get('interval_minutes', 1)
        # Avoid division by zero
        if interval_minutes <= 0: interval_minutes = 1
        short_gap_periods = int(SHORT_GAP_HOURS * 60 / interval_minutes)

        # interpolate short gaps
        filled = series.interpolate(method='linear', limit=short_gap_periods)

        # conservative substitution for long gaps
        p10 = series.quantile(0.10)
        if pd.isna(p10): p10 = 0 # Fallback if all NaN
        filled = filled.fillna(p10)

        self.substitution_count = series.isna().sum() # Should be 0 after fill, but keeping original logic intention
        return filled

    def audit_log(self):
        return {"strategy": "Puro Biochar", "substitutions": int(self.substitution_count)}

def get_strategy(name: str) -> GapFillingStrategy:
    strategies = {
        'epa': EPASubpartRR(),
        'alberta': AlbertaTIER(),
        'lcfs': CaliforniaLCFS(),
        'puro': PuroBiochar()
    }
    return strategies.get(name.lower(), CaliforniaLCFS()) # Default to conservative
