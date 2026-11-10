const $ = (selector) => document.querySelector(selector);
const number = new Intl.NumberFormat('ko-KR');
const decimal = new Intl.NumberFormat('ko-KR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
let marketData = null;
let selectedMarket = 'all';
let selectedCode = null;
let loading = false;
let favorites = new Set();
try { const saved = JSON.parse(localStorage.getItem('marketnote-favorites') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved); } catch (_) { /* 저장소를 사용할 수 없으면 현재 화면에서만 유지합니다. */ }

function direction(value) { return value > 0 ? 'up' : value < 0 ? 'down' : 'flat'; }
function signed(value, decimals = false) { return `${value > 0 ? '+' : value < 0 ? '−' : ''}${(decimals ? decimal : number).format(Math.abs(value))}`; }
function value(value) { return value == null ? '—' : number.format(value); }
function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function toggleFavorite(code) {
  if (favorites.has(code)) favorites.delete(code); else favorites.add(code);
  try { localStorage.setItem('marketnote-favorites', JSON.stringify([...favorites])); } catch (_) { /* 브라우저 저장소가 차단된 경우 */ }
  render();
  if ($('#detail').open && selectedCode === code) renderDetail();
}
function render() {
  if (!marketData) return;
  $('#indices').innerHTML = marketData.indices.map((item) => `<article class="index-card"><div class="index-top"><span class="index-symbol">${item.code === 'KOSPI' ? 'K' : 'Q'}</span><div><strong>${escapeHtml(item.code)}</strong><small>${item.code === 'KOSPI' ? '코스피 지수' : '코스닥 지수'}</small></div><span class="index-arrow ${direction(item.change)}">${item.change < 0 ? '↘' : item.change > 0 ? '↗' : '→'}</span></div><div class="index-bottom"><strong>${decimal.format(item.price)}</strong><span class="index-change ${direction(item.change)}">${signed(item.change, true)} <b>${signed(item.rate, true)}%</b></span></div><div class="index-caption">전일 대비 <span>INDEX / KR</span></div></article>`).join('');
  const stocks = marketData.stocks;
  const up = stocks.filter(x => x.change > 0).length, down = stocks.filter(x => x.change < 0).length;
  $('#indices').insertAdjacentHTML('beforeend', `<article class="breadth-card"><div class="breadth-top"><span>WATCHLIST PULSE</span><span>✳</span></div><strong>오늘의 종목 온도</strong><p>대표 종목 ${stocks.length}개 기준</p><div class="breadth-bar" aria-label="상승 ${up}, 보합 ${stocks.length - up - down}, 하락 ${down}"><span style="width:${up/stocks.length*100}%"></span><span style="width:${(stocks.length-up-down)/stocks.length*100}%"></span><span style="width:${down/stocks.length*100}%"></span></div><div class="breadth-legend"><span>상승 <b>${up}</b></span><span>보합 <b>${stocks.length-up-down}</b></span><span>하락 <b>${down}</b></span></div></article>`);
  const query = $('#search').value.trim().toLowerCase();
  const items = stocks.filter(x => (selectedMarket === 'all' || (selectedMarket === 'favorites' ? favorites.has(x.code) : x.market === selectedMarket)) && (x.name.toLowerCase().includes(query) || x.code.includes(query)));
  const sort = $('#sort').value;
  if (sort === 'up') items.sort((a,b) => b.rate-a.rate);
  if (sort === 'down') items.sort((a,b) => a.rate-b.rate);
  if (sort === 'volume') items.sort((a,b) => (b.volume ?? -1)-(a.volume ?? -1));
  if (sort === 'name') items.sort((a,b) => a.name.localeCompare(b.name, 'ko'));
  $('#count-all').textContent = stocks.length;
  $('#favorite-count').textContent = favorites.size;
  $('#stocks').innerHTML = items.length ? items.map(item => `<tr><td><button class="star ${favorites.has(item.code) ? 'selected' : ''}" data-favorite="${escapeHtml(item.code)}" aria-label="${escapeHtml(item.name)} 관심 종목 ${favorites.has(item.code) ? '해제' : '추가'}" aria-pressed="${favorites.has(item.code)}">${favorites.has(item.code) ? '★' : '☆'}</button></td><td><button class="stock-button" data-detail="${escapeHtml(item.code)}"><span class="stock-avatar">${escapeHtml(item.name.slice(0,1))}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)} <i>·</i> ${escapeHtml(item.market)}</small></span></button></td><td class="price">${value(item.price)} <small>원</small></td><td class="${direction(item.change)}">${signed(item.change)}</td><td><span class="rate ${direction(item.rate)}">${signed(item.rate, true)}%</span></td><td>${value(item.volume)}</td><td><button class="row-arrow" data-detail="${escapeHtml(item.code)}" aria-label="${escapeHtml(item.name)} 상세 보기">↗</button></td></tr>`).join('') : `<tr><td colspan="7" class="empty"><span>✳</span>${selectedMarket === 'favorites' && !favorites.size && !query ? '관심 종목이 아직 없어요. 별을 눌러 담아보세요.' : '검색 결과가 없습니다.'}</td></tr>`;
}
function renderDetail() {
  const item = marketData?.stocks.find(x => x.code === selectedCode);
  if (!item) return;
  const hasRange = item.low != null && item.high != null && item.high > item.low;
  const position = hasRange ? Math.max(0, Math.min(100, (item.price - item.low) / (item.high - item.low) * 100)) : 50;
  $('#detail-content').innerHTML = `<div class="detail-title"><div><span>${escapeHtml(item.market)} · ${escapeHtml(item.code)}</span><h3 id="detail-name">${escapeHtml(item.name)}</h3></div><button class="detail-star ${favorites.has(item.code) ? 'selected' : ''}" data-favorite="${escapeHtml(item.code)}" aria-pressed="${favorites.has(item.code)}" aria-label="관심 종목 ${favorites.has(item.code) ? '해제' : '추가'}">${favorites.has(item.code) ? '★' : '☆'}</button></div><div class="detail-price">${value(item.price)}<small>원</small></div><div class="detail-change ${direction(item.change)}">${signed(item.change)}원 <span>${signed(item.rate, true)}%</span> <small>전일 대비</small></div><div class="range-box"><div class="range-title">오늘의 가격 범위 <span>DAY RANGE</span></div><div class="range-track"><i style="left:${position}%"></i></div><div class="range-labels"><span>저가 <b>${value(item.low)}</b></span><span>고가 <b>${value(item.high)}</b></span></div>${hasRange ? '' : '<p class="range-unavailable">가격 범위 정보가 없습니다.</p>'}</div><div class="detail-grid"><div><span>전일 종가</span><b>${value(item.previous)}</b></div><div><span>시가</span><b>${value(item.open)}</b></div><div><span>거래량</span><b>${value(item.volume)}</b></div><div><span>시장</span><b>${escapeHtml(item.market)}</b></div></div><a class="detail-link" href="https://finance.naver.com/item/main.naver?code=${encodeURIComponent(item.code)}" target="_blank" rel="noopener noreferrer">네이버 증권에서 자세히 보기 <span>↗</span></a><p class="detail-foot">네이버 증권 제공 · 시세는 지연될 수 있습니다.</p>`;
}
async function refresh() {
  if (loading) return;
  loading = true; $('#refresh').disabled = true; $('#refresh').classList.add('spinning');
  try {
    const response = await fetch('/api/market', {cache:'no-store'});
    if (!response.ok) throw new Error('시세 요청 실패');
    marketData = await response.json(); render();
    if ($('#detail').open) renderDetail();
    const date = marketData.source_time == null ? null : new Date(marketData.source_time);
    $('#updated').textContent = !date || Number.isNaN(date.valueOf()) ? '시세 확인 완료' : `${new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'}).format(date)} 기준`;
    $('#status').hidden = true;
  } catch (_) {
    $('#status').textContent = marketData ? '시세 갱신에 실패했습니다. 마지막으로 가져온 데이터를 표시합니다.' : '시세를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
    $('#status').hidden = false;
    if (!marketData) { $('#indices').innerHTML = '<div class="index-card loading">시장 지수를 불러오지 못했습니다.</div>'; $('#stocks').innerHTML = '<tr><td colspan="7" class="empty">시세를 불러오지 못했습니다.</td></tr>'; }
  } finally { loading = false; $('#refresh').disabled = false; $('#refresh').classList.remove('spinning'); }
}
$('#search').addEventListener('input', render);
$('#sort').addEventListener('change', render);
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => { selectedMarket = button.dataset.market; document.querySelectorAll('.tab').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', active); }); render(); }));
document.addEventListener('click', event => {
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) { toggleFavorite(favorite.dataset.favorite); return; }
  const detail = event.target.closest('[data-detail]');
  if (detail) { selectedCode = detail.dataset.detail; renderDetail(); $('#detail').showModal(); }
});
$('#close-detail').addEventListener('click', () => $('#detail').close());
$('#detail').addEventListener('click', event => { if (event.target === $('#detail')) $('#detail').close(); });
document.addEventListener('keydown', event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('#detail').open) { event.preventDefault(); $('#search').focus(); } });
$('#refresh').addEventListener('click', refresh);
refresh(); setInterval(refresh, 60000);
