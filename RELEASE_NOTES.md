# korea-unipass-mcp 릴리즈 노트 (Release Notes)

## Version 1.0.0

🎉 **`korea-unipass-mcp` 첫 번째 정식 배포 (Initial Public Release)**

### ✨ 주요 기능 (Features)
- **실시간 통관 조회 (Real-time Customs Clearance Tracking)**: Anthropic Claude Desktop/Code를 통해 관세청 화물통관진행정보를 실시간으로 조회합니다.
- **특송화물 연도 자동 보정 (Support for E-commerce)**: 알리익스프레스(AliExpress) 등 연도를 넘나드는 배송의 경우, 현재 연도에서 결과가 없으면 자동으로 전년도 데이터를 재조회합니다.
- **가독성 높은 마크다운 출력 (Rich Markdown Formatting)**: 
  - 진행 상태에 따른 시각적 이모지(배지) 제공.
  - 날짜/시간을 읽기 편한 한국어 형식(03월 07일 (토))으로 변환.
  - 시간 역순이 아닌 직관적인 통관 단계 타임라인 제공.
- **간편한 설치 (Easy Installation via `npx`)**: `npx`를 사용해 글로벌 설치 없이 Claude 설정만으로 즉시 구동 가능합니다.

### 🛠 사용 방법 (Setup & Usage)

Claude Desktop 설정 파일(`claude_desktop_config.json`)에 아래 내용을 추가하세요:

```json
{
  "mcpServers": {
    "korea-unipass": {
      "command": "npx",
      "args": ["-y", "korea-unipass-mcp"],
      "env": {
        "KOREA_CUSTOMS_API_KEY": "YOUR_UNIPASS_API_KEY" // 발급받은 실제 API 키 입력
      }
    }
  }
}
```

설정 후 Claude에게 다음과 같이 질문하세요:
> **"운송장 번호 998000341213 통관 현황을 형식 그대로 모두 보여줘"**
