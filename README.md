# Cursor Launcher Web

Cursor 프로젝트를 웹 브라우저에서 시각적으로 관리하고 실행할 수 있는 웹 애플리케이션입니다.

## 기능

- 프로젝트 목록 시각적 표시
- 최근 실행한 프로젝트 (최대 8개)
- 즐겨찾기 프로젝트 관리
- 마우스 클릭으로 프로젝트 열기
- 전체 프로젝트 목록
- 웹에서 프로젝트 추가/관리
- 카테고리별 프로젝트 관리 (탭)
- Firebase를 통한 데이터 관리

## 설치 및 실행

### 1. 의존성 설치

```bash
# 루트 디렉토리에서
npm install

# 클라이언트 디렉토리에서
cd client
npm install
cd ..
```

### 2. Firebase 설정

1. Firebase Console에서 프로젝트 생성
2. Firestore Database 활성화
3. `client/.env` 파일 생성 (`.env.example` 참고)
4. Firebase 설정 정보 입력:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 3. 서버 실행

```bash
# 개발 모드 (서버 + 클라이언트 동시 실행)
npm run dev

# 또는 개별 실행
npm run server  # 백엔드 서버 (포트 3001) - Cursor 실행용
npm run client  # 프론트엔드 (포트 3000)
```

### 4. 브라우저에서 접속

http://localhost:3000 에서 웹 애플리케이션을 사용할 수 있습니다.

## 사용 방법

1. **프로젝트 열기**: 프로젝트 카드를 클릭하면 Cursor에서 해당 프로젝트가 열립니다.
2. **즐겨찾기 추가/제거**: 프로젝트 카드의 별 아이콘을 클릭하여 즐겨찾기를 토글할 수 있습니다.
3. **최근 프로젝트**: 최근에 열었던 프로젝트가 상단에 표시됩니다 (최대 8개).
4. **프로젝트 추가**: 상단의 "프로젝트 추가" 버튼을 클릭하여 새로운 프로젝트를 추가할 수 있습니다.
5. **카테고리 관리**: "카테고리 관리" 버튼을 클릭하여 카테고리를 추가/삭제할 수 있습니다.
6. **프로젝트 수정/삭제**: 각 프로젝트 카드의 편집/삭제 버튼을 사용할 수 있습니다.

## 파일 구조

```
cursor-launcher/
├── server/
│   └── index.js          # Express 백엔드 서버 (Cursor 실행용)
├── client/
│   ├── src/
│   │   ├── App.jsx       # 메인 React 컴포넌트
│   │   ├── App.css       # 스타일
│   │   ├── main.jsx      # 진입점
│   │   ├── firebase.js   # Firebase 설정
│   │   └── firebaseService.js  # Firebase 서비스 함수
│   └── package.json
└── package.json
```

## 배포

### 프로덕션 빌드

```bash
# 클라이언트 빌드
npm run build

# 프로덕션 서버 실행
npm start  # Linux/Mac
npm run start:win  # Windows
```

프로덕션 모드에서는 서버가 클라이언트 빌드 파일을 자동으로 서빙합니다.

### 환경 변수

- `PORT`: 서버 포트 (기본값: 3001)
- `NODE_ENV`: 환경 설정 (`production` 또는 `development`)

## 요구사항

- Node.js 14 이상
- Firebase 프로젝트 (Firestore 활성화)
- Cursor가 시스템 PATH에 등록되어 있어야 함 (로컬 실행 시)

## 데이터 관리

- 모든 데이터는 Firebase Firestore에서 관리됩니다.
- 프로젝트, 카테고리, 즐겨찾기, 최근 목록이 Firebase에 저장됩니다.
- Cursor 실행은 로컬 백엔드 서버를 통해 처리됩니다.
