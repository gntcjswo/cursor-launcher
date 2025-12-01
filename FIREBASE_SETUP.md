# Firebase 인증 설정 가이드

## 1. Firebase Authentication 활성화

1. Firebase Console → Authentication
2. "시작하기" 클릭
3. "Sign-in method" 탭 클릭
4. "Google" 제공업체 클릭
5. "사용 설정" 토글을 켜기
6. 프로젝트 지원 이메일 선택
7. "저장" 클릭
8. **승인된 도메인 추가** (중요):
   - "승인된 도메인" 섹션에서
   - "도메인 추가" 클릭
   - `localhost` 추가 (이미 있을 수 있음)
   - 배포 시 실제 도메인도 추가 필요

## 2. Firestore 보안 규칙 설정

Firebase Console → Firestore Database → 규칙 탭에서 다음 규칙 적용:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 허용된 사용자 확인 함수
    function isAllowedUser() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/allowedUsers/$(request.auth.token.email));
    }
    
    // 허용된 사용자 컬렉션 (문서 ID는 이메일 주소)
    match /allowedUsers/{email} {
      // 자신의 이메일 문서만 읽을 수 있음 (문서 ID가 자신의 이메일과 일치)
      allow read: if request.auth != null && request.auth.token.email == email;
      allow write: if false; // 수동으로만 추가 (Firebase Console에서)
    }
    
    // 프로젝트
    match /projects/{projectId} {
      allow read: if true; // 모든 사용자가 읽기 가능
      allow write: if isAllowedUser();
    }
    
    // 카테고리
    match /categories/{categoryId} {
      allow read: if true;
      allow write: if isAllowedUser();
    }
    
    // 즐겨찾기
    match /favorites/{favoriteId} {
      allow read: if true;
      allow write: if isAllowedUser();
    }
    
    // 최근 프로젝트
    match /recent/{recentId} {
      allow read: if true;
      allow write: if isAllowedUser();
    }
    
    // 사용자 설정 (문서 ID는 이메일 주소)
    match /userSettings/{email} {
      // 자신의 설정만 읽고 쓸 수 있음
      allow read, write: if request.auth != null && request.auth.token.email == email;
    }
  }
}
```

## 3. 허용된 사용자 추가

Firebase Console → Firestore Database → 데이터 탭에서:

1. **컬렉션 시작** 클릭
2. 컬렉션 ID: `allowedUsers` 입력
3. 문서 ID: **로그인한 이메일 주소를 정확히 입력** (예: `your-email@gmail.com`)
4. 필드 추가 (선택사항):
   - 필드: `email` (문자열)
   - 값: 이메일 주소
5. **저장** 클릭

**중요**: 
- 문서 ID는 로그인한 이메일 주소와 **정확히 일치**해야 합니다
- 대소문자도 구분됩니다
- 이메일 주소를 복사해서 붙여넣는 것을 권장합니다

**현재 로그인한 이메일 확인 방법**:
- 브라우저 콘솔에서 `auth.currentUser.email` 확인
- 또는 화면에 표시된 이메일 주소 사용

## 4. 테스트

1. 허용되지 않은 계정으로 로그인 → 읽기만 가능
2. 허용된 계정으로 로그인 → 읽기/쓰기 모두 가능
3. 프로젝트 클릭 시 권한 확인

