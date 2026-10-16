"""Macro alarm share for the QLD strategy.

Fourteen indicators, each oriented so that a higher value means more risk (set from economic priors,
not fitted to returns). Each is lagged by its own publication delay, then standardized against its own
trailing three years (756 trading days, at least one year), so no future information is used.
An indicator is "in alarm" when that z-score is above 1. The alarm share is alarms / indicators that
have data on that day (at least five). The strategy exits when the share newly crosses 50%.
"""
import os
import numpy as np
import pandas as pd

# (key, label, how to read it, publication lag in calendar days)
SPEC = [
    ('baa', '신용: BAA 회사채 스프레드', '높을수록 위험', 1),
    ('baa3m', '신용: BAA 스프레드 3개월 확대폭', '빠르게 벌어질수록 위험', 1),
    ('dflt', '신용: BAA-AAA 부도 스프레드', '높을수록 위험', 1),
    ('curve', '금리: 장단기차(10Y-3M) 3개월 재가팽창', '역전 뒤 빠르게 가팔라질수록 위험', 1),
    ('cut', '금리: 기준금리 6개월 인하폭', '급하게 내릴수록 위험', 1),
    ('stl', '스트레스: 세인트루이스 연준 금융스트레스', '높을수록 위험', 6),
    ('nfcir', '스트레스: 시카고 연준 NFCI 위험 하위지수', '높을수록 위험', 5),
    ('ted', '스트레스: TED 스프레드 (2022년 종료)', '높을수록 위험', 1),
    ('vterm', '스트레스: VIX / 3개월 VIX', '1을 넘으면 급성 공포', 1),
    ('claims', '고용: 신규 실업수당 4주평균 전년비', '늘수록 위험', 5),
    ('sahm', '고용: 실시간 삼의 법칙', '0.5 이상이면 침체 신호', 36),
    ('dxy', '시장: 달러지수 6개월 상승률', '급등할수록 위험', 1),
    ('small', '시장: 소형주/대형주 6개월 부진', '소형주가 뒤처질수록 위험', 1),
    ('cugold', '시장: 구리/금 비율 6개월 하락', '경기 기대가 꺾일수록 위험', 1),
]
LABEL = {k: l for k, l, _, _ in SPEC}
HOW = {k: h for k, _, h, _ in SPEC}
LAG = {k: g for k, _, _, g in SPEC}


def _fred(mdir, s):
    p = os.path.join(mdir, f'{s}.csv')
    if not os.path.exists(p):
        return pd.Series(dtype=float)
    x = pd.read_csv(p)
    return pd.Series(pd.to_numeric(x.iloc[:, 1], errors='coerce').values, index=pd.to_datetime(x.iloc[:, 0])).dropna()


def _yahoo(mdir, s):
    p = os.path.join(mdir, f'Y_{s}.csv')
    if not os.path.exists(p):
        return pd.Series(dtype=float)
    return pd.read_csv(p, parse_dates=['date'], index_col='date')['value'].dropna()


def raw_indicators(mdir):
    f = lambda s: _fred(mdir, s)
    y = lambda s: _yahoo(mdir, s)
    baa, aaa, t3m, dff = f('BAA10Y'), f('AAA10Y'), f('T10Y3M'), f('DFF')
    ic = f('ICSA'); ic4 = ic.rolling(4).mean()
    vix, vxv = f('VIXCLS'), f('VXVCLS')
    rut, spx, cu, au, dxy = y('RUT'), y('SPX'), y('COPPER'), y('GOLD'), y('DXY')
    rs = (rut / spx).dropna(); cg = (cu / au).dropna()
    return {
        'baa': baa,
        'baa3m': baa - baa.shift(63),
        'dflt': (baa - aaa).dropna(),
        'curve': t3m - t3m.shift(63),
        'cut': -(dff - dff.shift(126)),
        'stl': f('STLFSI4'),
        'nfcir': f('NFCIRISK'),
        'ted': f('TEDRATE'),
        'vterm': (vix / vxv.reindex(vix.index)).dropna(),
        'claims': ic4 / ic4.shift(52) - 1,
        'sahm': f('SAHMREALTIME'),
        'dxy': dxy / dxy.shift(126) - 1,
        'small': -(rs / rs.shift(126) - 1),
        'cugold': -(cg / cg.shift(126) - 1),
    }


def compute(mdir, index):
    """Return (raw, z, share) DataFrames/Series aligned to `index` (trading days)."""
    index = pd.DatetimeIndex(index)
    raw, Z = {}, {}
    for k, s in raw_indicators(mdir).items():
        s = s.dropna()
        if s.empty:
            raw[k] = pd.Series(np.nan, index=index); Z[k] = raw[k]; continue
        s = s.copy(); s.index = s.index + pd.Timedelta(days=LAG[k])
        a = s.reindex(index.union(s.index)).ffill().reindex(index)
        # stop forward-filling a series that has ended (e.g. TED): no value 90 days after its last print
        last = s.index.max()
        a[index > last + pd.Timedelta(days=90)] = np.nan
        raw[k] = a
        m = a.rolling(756, min_periods=252).mean(); sd = a.rolling(756, min_periods=252).std()
        Z[k] = ((a - m) / sd).clip(-4, 4)
    Zdf = pd.DataFrame(Z)
    n = Zdf.notna().sum(axis=1)
    share = ((Zdf > 1).sum(axis=1) / n).where(n >= 5)
    return pd.DataFrame(raw), Zdf, share
