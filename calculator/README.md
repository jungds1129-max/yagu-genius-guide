# 야구천재 계산기

서비스: https://diamond-trait-calc.harooyaho.chatgpt.site/

특성·과금·경험치·스탯 미리보기·Google 로그인 기반 비공개 덱 관리 및 전지훈련 비교 소스입니다. 2026-11-03 Sites 배포 버전 18 소스를 가져왔습니다.

## 구성
- web/: 브라우저 소스
- worker/api.mjs: Google ID 토큰 검증 및 계정별 R2 저장
- build-deck.mjs: web 자산과 API를 단일 Worker로 빌드

빌드 전 calculator/.openai/hosting.json에 기존 Sites 프로젝트의 project_id와 r2 바인딩 BUCKET을 설정한 뒤 calculator 폴더에서 `node build-deck.mjs`를 실행합니다. 런타임 GOOGLE_CLIENT_ID는 배포 환경에 설정하며, Google OAuth 허용 origin과 /api/deck/login redirect URI가 배포 주소와 일치해야 합니다. 클라이언트 비밀번호는 사용하지 않습니다.

개인 덱 데이터는 포함하지 않습니다. GitHub에 커밋해도 운영 사이트가 자동 배포되지는 않습니다. 코드의 추정 모델은 가이드 최신 내용과 비교해 수정·검증한 후 별도로 배포해야 합니다.
