# 📦 korea-unipass-mcp

> **대한민국 관세청 유니패스(UNI-PASS) 실시간 통관 조회 MCP 서버**

[![npm version](https://img.shields.io/npm/v/korea-unipass-mcp)](https://www.npmjs.com/package/korea-unipass-mcp)

`korea-unipass-mcp`는 Anthropic Claude(Desktop/Code) 내에서 AI 에이전트가 운송장 번호만으로 해외 직구 물품의 통관 상태를 실시간으로 조회할 수 있도록 돕는 **Model Context Protocol(MCP)** 서버입니다.

## ✨ 주요 기능
- **실시간 통관 추적**: 관세청 공식 API를 통해 현재 화물의 위치와 통관 단계 조회.
- **쉬운 용어 풀이**: AI가 복잡한 관세 용어(하선신고, 수입결재 등)를 친절하게 설명.
- **연도 자동 처리**: 현재 연도 → 전년도 순으로 자동 조회하여 연도 경계 배송도 정확히 탐지.

## 🛠 설치 방법

### 1. API 키 발급 방법

이 서버를 사용하려면 관세청 유니패스(UNI-PASS)에서 직접 API 키를 발급받아야 합니다.

1. [유니패스(UNI-PASS)](https://unipass.customs.go.kr) 접속 후 회원가입 및 로그인
2. 오른쪽 상단 **사이트맵** 클릭
3. 펼쳐지는 메뉴 중 **서비스관리** 영역에서 **OpenAPI 사용관리** 클릭
4. OpenAPI 목록에서 **6번째 페이지**로 이동
5. 목록 마지막 항목인 **화물통관진행정보조회** 클릭
6. 페이지 중앙 오른쪽의 **[OPEN API 신청]** 버튼 클릭 → 신청 완료
7. 다시 **화물통관진행정보조회**를 선택하면 상세 내역 화면에서 **인증키**를 확인할 수 있습니다.

### 2. Claude Desktop 설정

`claude_desktop_config.json` 파일을 열고 아래 내용을 추가하세요.

#### ✅ 방법 1: npx 사용 (권장 — 별도 설치 불필요)

```json
{
  "mcpServers": {
    "korea-unipass": {
      "command": "npx",
      "args": ["-y", "korea-unipass-mcp"],
      "env": {
        "KOREA_CUSTOMS_API_KEY": "유니패스_OpenAPI_인증키"
      }
    }
  }
}
```

#### 방법 2: 로컬 직접 실행 (소스 클론 후)

```bash
git clone https://github.com/NotNull92/korea-unipass-mcp.git
cd korea-unipass-mcp
npm install && npm run build
```

```json
{
  "mcpServers": {
    "korea-unipass": {
      "command": "node",
      "args": ["/절대경로/korea-unipass-mcp/dist/index.js"],
      "env": {
        "KOREA_CUSTOMS_API_KEY": "유니패스_OpenAPI_인증키"
      }
    }
  }
}
```

## 💬 사용 방법

설정 완료 후 Claude에게 아래와 같이 질문하세요.

### ✅ 권장 질문 형식

> **"운송장 번호 [번호] 통관 현황을 형식 그대로 모두 보여줘"**

```
예시: 운송장 번호 998000341213 통관 현황을 형식 그대로 모두 보여줘
```

> **주의:** Claude AI는 도구 결과를 자동으로 요약하는 특성이 있습니다.  
> 위 문구처럼 **"형식 그대로 모두"** 라는 표현을 포함해야 전체 통관 정보가 항목별로 출력됩니다.

### 📝 출력 항목 예시
- 📅 통관 진행 일정 (입항일, 완료일, 진행상태)
- 📦 통관 정보 (물품, 적출국, 적재항, 세관명 등)
- 🏢 화물운송주선업자
- ✈️ 운송편 정보 (항공사, 편명)
- ⏳ 통관 단계 이력 (전체 단계 타임라인)