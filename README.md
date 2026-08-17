# 성균관대 식당 메뉴 이상형 월드컵

성균관대 인문사회과학캠퍼스/자연과학캠퍼스 교내식당 메뉴로 만든 이상형 월드컵.

- 데이터 출처: https://www.skku.edu/skku/campus/support/welfare_11.do (인사캠), .../welfare_11_1.do (자연캠)
- 대상 식당 8곳: 패컬티식당, 은행골식당, 법고을식당, 금잔디식당 (인사캠) / 행단골식당, 구시재식당, 해오름식당, THE S LOUNGE (자연캠)

## 구조

```
scraper/scrape.py    식당별 최신 서로 다른 메뉴(최대 32개)를 주 단위로 거슬러 올라가며 수집
data/menus.json       수집 결과 (원본)
docs/                 정적 웹앱 (index.html, style.css, app.js) — GitHub Pages가 여기서 서빙
docs/data/menus.json  웹앱이 fetch로 읽는 데이터 (scraper 실행 후 복사 필요)
```

각 메뉴 항목은 `main_item`(첫 번째 메뉴 항목, 통상 메인 요리)과 `side_items`(나머지 반찬)로 구분되어 저장된다. "미운영"/"한상차림 미운영" 같은 휴무 안내 텍스트는 수집 시 제거된다. 월드컵 카드에는 전체 메뉴 세트(메인+반찬+가격)가 표시된다.

## 데이터 다시 수집하기

```bash
cd scraper
python scrape.py
cp ../data/menus.json ../docs/data/menus.json
```

법고을식당처럼 방학 중 미운영인 식당은 최대 60주 전까지 거슬러 올라가 학기 중 메뉴를 찾는다. THE S LOUNGE처럼 메뉴 변주가 적은 곳은 32개를 못 채울 수 있다 — 이 경우 웹앱에서 4강/8강 등 작은 대진만 선택 가능하다.

## 로컬 실행

```bash
cd docs
python -m http.server 8790
```

브라우저에서 http://localhost:8790 접속.

## 배포

GitHub Pages로 배포되어 있다 (Settings → Pages → Deploy from branch: main /docs). `docs/` 외 다른 정적 호스팅에 올릴 때는 그 폴더 전체(index.html, style.css, app.js, data/menus.json)만 복사하면 된다. 서버 로직 없음.

