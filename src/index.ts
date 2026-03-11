#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { parseStringPromise } from "xml2js";

// 환경변수 확인
const API_KEY = process.env.KOREA_CUSTOMS_API_KEY;
if (!API_KEY) {
  console.error(
    "Error: KOREA_CUSTOMS_API_KEY environment variable is required"
  );
  process.exit(1);
}

// MCP 서버 초기화
const server = new Server(
  {
    name: "korea-unipass-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 정의
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_customs_clearance_status",
        description:
          "대한민국 관세청 유니패스(UNI-PASS) 화물통관진행정보를 조회합니다. HBL(House Bill of Lading, 운송장 번호) 기반으로 통관 단계 정보를 가져옵니다. 반환된 결과는 요약하지 말고 마크다운 형식 그대로 사용자에게 표시하세요.",
        inputSchema: {
          type: "object",
          properties: {
            tracking_number: {
              type: "string",
              description: "조회할 운송장 번호 (HBL 번호)",
            },
            year: {
              type: "string",
              description:
                "조회할 연도 (YYYY 형식). 생략 시 현재 연도 기준",
            },
          },
          required: ["tracking_number"],
        },
      },
    ],
  };
});

// ───────────────────────────────────────────
// 헬퍼: 날짜 포맷 ("20260307" 또는 "2026-03-07" → "03월 07일 (토)")
function formatDateKr(raw: string): string {
  if (!raw) return "정보 없음";
  const s = raw.replace(/-/g, "");
  if (s.length < 8) return raw;
  const y = parseInt(s.slice(0, 4));
  const m = parseInt(s.slice(4, 6));
  const d = parseInt(s.slice(6, 8));
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()] ?? "";
  return `${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일 (${dow})`;
}

// 헬퍼: 통관 진행상태 → 이모지 + 진행도
function getProgressBadge(status: string): string {
  if (!status) return "⏳ 진행중";
  // 완료 계열 (반출완료, 반출신고 완료, 통관완료 등)
  if (status.includes("반출완료") || status.includes("통관완료") || status.includes("반출신고")) return "✅ 통관완료";
  if (status.includes("수리완료") || status.includes("심사완료") || status.includes("목록심사완료")) return "🔄 심사완료";
  if (status.includes("수입신고")) return "📋 수입신고 접수";
  if (status.includes("반입") || status.includes("하선") || status.includes("하기")) return "🛬 입항·반입 완료";
  if (status.includes("적재")) return "🚢 출발지 적재";
  return `⏳ ${status}`;
}

// API 단일 연도 조회 함수
async function fetchClearanceInfo(trackingNumber: string, year: string) {
  const apiUrl = `https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo?crkyCn=${API_KEY}&hblNo=${trackingNumber}&blYy=${year}`;
  const response = await axios.get(apiUrl, { responseType: "text" });
  const result = await parseStringPromise(response.data, {
    explicitArray: false,
    ignoreAttrs: true,
  });
  // 디버그: API 응답 필드 확인용 (stderr에만 출력, stdout 오염 없음)
  console.error("[DEBUG] API raw response:", JSON.stringify(result?.cargCsclPrgsInfoQryRtnVo, null, 2));
  return result?.cargCsclPrgsInfoQryRtnVo ?? null;
}

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "get_customs_clearance_status") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const tracking_number = request.params.arguments?.tracking_number;
  const yearArg = request.params.arguments?.year;
  const explicitYear = (typeof yearArg === "string" && yearArg.length === 4) ? yearArg : null;

  if (!tracking_number || typeof tracking_number !== "string") {
    throw new Error("tracking_number is required and must be a string");
  }

  try {
    const currentYear = new Date().getFullYear();
    // 명시적 연도가 없으면 현재 연도 → 전년도 순서로 시도 (알리 등 연도 경계 배송 대응)
    const yearsToTry = explicitYear
      ? [explicitYear]
      : [currentYear.toString(), (currentYear - 1).toString()];

    let bodyResult: any = null;
    let succeededYear = "";

    for (const yr of yearsToTry) {
      const result = await fetchClearanceInfo(tracking_number, yr);

      // API 자체 에러 메시지 체크
      if (result?.ntceInfo) {
        console.error("UNI-PASS API Error:", result.ntceInfo);
        return {
          content: [{ type: "text", text: `관세청 API 오류: ${result.ntceInfo}` }],
          isError: true,
        };
      }

      // 결과가 있으면 사용
      if (result?.tCnt !== "0" && result?.cargCsclPrgsInfoDtlQryVo) {
        bodyResult = result;
        succeededYear = yr;
        break;
      }

      console.error(`No result for year ${yr}, trying next year if available...`);
    }

    // 모든 연도에서 결과 없음
    if (!bodyResult) {
      const triedYears = yearsToTry.join(", ");
      return {
        content: [
          {
            type: "text",
            text: `운송장 번호 **${tracking_number}**에 대한 통관 진행 정보가 없습니다. (조회 시도 연도: ${triedYears}년)\n\n> 운송장 번호가 올바른지 확인하거나, 아직 한국 세관에 도착 전일 수 있습니다.`,
          },
        ],
      };
    }

    // 실제 API 응답 구조: 메인 정보는 cargCsclPrgsInfoQryVo 하위에 있음
    const info = bodyResult.cargCsclPrgsInfoQryVo;

    // 세부 단계 목록 (최신순 정렬되어 있음 → [0]이 가장 최근)
    const detailList: any[] = Array.isArray(bodyResult.cargCsclPrgsInfoDtlQryVo)
      ? bodyResult.cargCsclPrgsInfoDtlQryVo
      : [bodyResult.cargCsclPrgsInfoDtlQryVo];

    // 실제 필드명: prgsStts (prcsStts 아님)
    const currentStatus: string = info?.prgsStts || "";
    const progressBadge = getProgressBadge(currentStatus);
    const isCompleted = progressBadge.startsWith("✅");

    // prcsDttm 형식: "20260309100521" (YYYYMMDDHHMMSS, 대시 없음)
    const formatTime = (raw: string) => {
      if (!raw || raw.length < 12) return "";
      return `${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
    };
    const completedDttm = detailList[0]?.prcsDttm ?? "";  // 최신 처리 (인덱스 0)

    // ── 헤더 ──────────────────────────────────
    let out = `🚚 **운송장 번호**: ${tracking_number}\n`;
    out += `📊 **통관 진행도**: ${progressBadge}\n\n`;

    // ── 섹션 1: 통관 진행 일정 ──────────────
    out += `## 📅 통관 진행 일정\n`;
    out += `- **입항일**: ${formatDateKr(info?.etprDt ?? "")}\n`;
    out += `- **통관 완료일**: ${isCompleted ? `${formatDateKr(completedDttm.slice(0, 8))} ${formatTime(completedDttm)}` : "진행중"}\n`;
    out += `- **통관 진행상태**: ${currentStatus || "정보 없음"}\n\n`;

    // ── 섹션 2: 통관 정보 ────────────────────
    out += `## 📦 통관 정보\n`;
    out += `- **물품**: ${info?.prnm || "정보 없음"}`;
    if (info?.pckGcnt || info?.ttwg) {
      out += ` / 수량(무게): ${info.pckGcnt || "-"}개 (${info.ttwg || "-"}${info.wghtUt || "KG"})`;
    }
    out += `\n`;
    out += `- **통관 진행상태**: ${info?.csclPrgsStts || currentStatus || "정보 없음"}\n`;
    out += `- **진행 상태**: ${currentStatus || "정보 없음"}\n`;
    out += `- **적출국**: ${info?.shipNatNm || "정보 없음"}\n`;
    out += `- **적재항**: ${info?.ldprNm || "정보 없음"}\n`;
    out += `- **화물 구분**: ${info?.cargTp || info?.blPtNm || "정보 없음"}\n`;
    out += `- **세관명**: ${info?.etprCstm || "정보 없음"}\n`;
    out += `- **입항명**: ${info?.dsprNm || "정보 없음"}\n`;
    out += `- **입항일**: ${info?.etprDt || "정보 없음"}\n`;
    out += `- **처리일시**: ${completedDttm ? `${completedDttm.slice(0,4)}-${completedDttm.slice(4,6)}-${completedDttm.slice(6,8)} ${formatTime(completedDttm)}` : "정보 없음"}\n\n`;

    // ── 섹션 3: 화물운송주선업자 ─────────────
    if (info?.frwrEntsConm || info?.frwrSgn) {
      out += `## 🏢 화물운송주선업자\n`;
      out += `- **업체명**: ${info.frwrEntsConm || "정보 없음"}\n`;
      if (info.frwrSgn) out += `- **부호**: ${info.frwrSgn}\n`;
      out += `\n`;
    }

    // ── 섹션 4: 운송편 정보 ──────────────────
    if (info?.shcoFlco || info?.shipNm) {
      out += `## ✈️ 운송편 정보\n`;
      out += `- **운송사**: ${info.shcoFlco || "정보 없음"}\n`;
      if (info.shipNm) out += `- **운송편명**: ${info.shipNm}\n`;
      out += `\n`;
    }

    // ── 섹션 5: 통관 단계 이력 ───────────────
    out += `## ⏳ 통관 단계 이력\n`;
    detailList.forEach((dtl: any, i: number) => {
      const step = dtl.cargTrcnRelaBsopTpcd || "알수없음";
      const dttm: string = dtl.prcsDttm ?? "";
      const dateFormatted = dttm.length >= 8 ? formatDateKr(dttm.slice(0, 8)) : "";
      const timeFormatted = dttm.length >= 12 ? formatTime(dttm) : "";
      const note = dtl.rlbrCn ? ` _(${dtl.rlbrCn})_` : "";
      out += `${i + 1}. **${step}** ${dateFormatted}${timeFormatted ? " " + timeFormatted : ""}${note}\n`;
    });

    return {
      content: [{ type: "text", text: out }],
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Axios Error: ", error.message);
      return {
        content: [{ type: "text", text: `관세청 API 호출 중 에러가 발생했습니다: ${error.message}` }],
        isError: true,
      };
    }
    const e = error as Error;
    console.error("Unknown API Error: ", e);
    return {
      content: [{ type: "text", text: `알 수 없는 서버 에러 발생: ${e.message}` }],
      isError: true,
    };
  }
});


// Stdio 전송 시작 (일반적인 CLI MCP 서버 동작 방식)
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Korea UNIPASS MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
