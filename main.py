import json
import threading
import time
from pathlib import Path
from urllib.request import Request as UrlRequest, urlopen

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE = Path(__file__).resolve().parent
app = FastAPI()
app.mount('/static', StaticFiles(directory=BASE / 'static'), name='static')
templates = Jinja2Templates(directory=BASE / 'templates')

# 대표 종목을 고정해 네이버에 전달하는 요청량을 제한합니다.
STOCKS = {
    '005930': 'KOSPI', '000660': 'KOSPI', '373220': 'KOSPI', '207940': 'KOSPI',
    '005380': 'KOSPI', '000270': 'KOSPI', '005490': 'KOSPI', '035420': 'KOSPI',
    '105560': 'KOSPI', '055550': 'KOSPI', '035720': 'KOSPI', '006400': 'KOSPI',
    '247540': 'KOSDAQ', '086520': 'KOSDAQ', '196170': 'KOSDAQ', '028300': 'KOSDAQ',
    '068760': 'KOSDAQ', '035900': 'KOSDAQ', '293490': 'KOSDAQ', '263750': 'KOSDAQ',
}
CACHE_SECONDS = 30
_cache = {'at': 0, 'data': None}
_lock = threading.Lock()


def normalize_market(payload):
    if payload.get('resultCode') != 'success':
        raise ValueError('시세 응답 오류')
    result = payload.get('result') or {}
    areas = {area['name']: area.get('datas', []) for area in result.get('areas', [])}
    if not areas.get('SERVICE_INDEX') or not areas.get('SERVICE_ITEM'):
        raise ValueError('시세 데이터가 비어 있습니다')

    def quote(item, index=False):
        sign = -1 if str(item.get('rf')) in ('4', '5') else 1
        scale = 100 if index else 1
        return {
            'code': item['cd'], 'name': item.get('nm', item['cd']),
            'price': item['nv'] / scale, 'change': sign * item.get('cv', 0) / scale,
            'rate': sign * abs(item.get('cr', 0)), 'volume': item.get('aq'),
            'market': STOCKS.get(item['cd'], ''),
            'open': item.get('ov'), 'high': item.get('hv'), 'low': item.get('lv'),
            'previous': item.get('sv'),
        }

    return {'indices': [quote(x, True) for x in areas['SERVICE_INDEX']],
            'stocks': [quote(x) for x in areas['SERVICE_ITEM'] if x.get('cd') in STOCKS],
            'source_time': result.get('time')}


def get_market():
    with _lock:
        if _cache['data'] and time.monotonic() - _cache['at'] < CACHE_SECONDS:
            return _cache['data']
        codes = ','.join(STOCKS)
        url = f'https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:{codes}%7CSERVICE_INDEX:KOSPI,KOSDAQ'
        request = UrlRequest(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.naver.com/'})
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode(response.headers.get_content_charset() or 'utf-8'))
        data = normalize_market(payload)
        if not data['stocks']:
            raise ValueError('종목 데이터가 비어 있습니다')
        _cache.update(at=time.monotonic(), data=data)
        return data


@app.get('/')
@app.get('/tomato', include_in_schema=False)
def home(request: Request):
    return templates.TemplateResponse(request, 'index.html')


@app.get('/api/market')
def market():
    try:
        return get_market()
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=503, detail='시세를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') from exc


