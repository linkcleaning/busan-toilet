# 부산 공중화장실 안내 (Ddong 부산)

제주·서울경기 Ddong 앱과 같은 화면·기능의 부산판입니다. 색상만 다릅니다 (바다 파랑 + 노랑).

## 데이터

- 원본: 공공데이터포털 전국공중화장실표준데이터 중 부산광역시 (`data-source/busan-toilets.csv`)
- 이 원본에는 위도·경도가 없어서, GitHub Actions가 카카오 로컬 API로 주소를 좌표로 바꿉니다.
- 찾은 좌표는 `data/geocode-cache.json`에 저장되어 다음부터는 다시 찾지 않습니다.

### 처음 한 번 설정

1. Settings → Secrets and variables → Actions → New repository secret
   이름 `KAKAO_REST_API_KEY`, 값에 카카오 REST API 키 (제주 앱과 같은 키)
2. Actions → "부산 화장실 데이터 만들기" → Run workflow
3. 5~10분 뒤 `data/toilets.json`이 만들어져 자동 커밋됩니다.

`data-source/busan-toilets.csv`를 새 파일로 바꿔 올리면 자동으로 다시 만들어집니다.

## 배포

Settings → Pages → Branch `main`, 폴더 `/ (root)` → Save
주소: https://linkcleaning.github.io/busan-toilet/
