"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useSync } from "@/lib/sync";
import type {
  PresidingSection,
  PresidingConfig,
  PresidingPrefs,
  ProgramWeek,
  MeetingSession,
  SectionGroup,
  TimerLogEntry,
  TimerRole,
} from "@/types/presiding";
import {
  SECTION_COLORS,
  SECTION_ICONS,
  totalPresidingMinutes,
  createPresidingSection,
  getDefaultWeek,
  getJwWolWeekCatalogEntry,
  getTimerRoles,
} from "@/types/presiding";

/* ---------- helpers ---------- */

interface FlatSection {
  sectionId: string; parentId: string | null;
  titleEn: string; titleEs: string; assigneeName: string;
  durationSec: number; group: SectionGroup; flatIdx: number;
}

function flattenAll(sections: PresidingSection[]): FlatSection[] {
  const out: FlatSection[] = [];
  let i = 0;
  for (const s of sections) {
    if (s.subsections.length > 0) {
      for (const sub of s.subsections) {
        out.push({ sectionId: sub.id, parentId: s.id, titleEn: sub.titleEn, titleEs: sub.titleEs,
          assigneeName: sub.assigneeName, durationSec: sub.duration * 60, group: s.group, flatIdx: i++ });
      }
    } else {
      out.push({ sectionId: s.id, parentId: null, titleEn: s.titleEn, titleEs: s.titleEs,
        assigneeName: s.assigneeName, durationSec: s.duration * 60, group: s.group, flatIdx: i++ });
    }
  }
  return out;
}

function fmtTime(sec: number, showSign = false): string {
  const a = Math.abs(sec); const m = Math.floor(a / 60); const s = a % 60;
  return `${showSign && sec < 0 ? "-" : ""}${m}:${s.toString().padStart(2, "0")}`;
}

function fmtClock(totalMin: number, is24: boolean): string {
  const h = Math.floor(totalMin / 60) % 24; const m = totalMin % 60;
  if (is24) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ---------- labels ---------- */

function SectionIcon({ icon, className }: { icon: string | null; className?: string }) {
  if (!icon) return null;
  if (icon === "sheep") {
    return (
      <svg viewBox="0 0 1280 1278" className={className} fill="currentColor">
        <g transform="translate(0 1278) scale(.1 -.1)">
        <path d="M10960 12738 l-64 -41 -153 27 -153 28 -92 -27 c-51 -15 -98 -30
-104 -34 -6 -3 -45 -45 -88 -93 l-77 -88 -173 0 c-122 0 -177 -4 -188 -12 -9
-7 -69 -71 -132 -142 -102 -115 -126 -135 -213 -187 -91 -53 -102 -63 -153
-139 -47 -69 -57 -94 -71 -163 l-15 -82 -114 -52 c-62 -29 -119 -58 -125 -65
-7 -7 -29 -53 -50 -102 -41 -97 -41 -99 -1 -229 l15 -47 -107 -54 -107 -54
-40 -88 c-36 -81 -40 -98 -45 -194 l-5 -105 -92 -65 c-88 -62 -94 -69 -147
-166 -52 -94 -56 -105 -56 -167 l0 -67 -54 -27 c-46 -23 -70 -48 -148 -148
l-94 -120 -97 -16 c-90 -15 -105 -21 -182 -73 -52 -34 -99 -75 -122 -106 -20
-27 -43 -50 -49 -50 -7 0 -80 17 -162 39 l-149 39 -144 -29 c-79 -16 -177 -40
-219 -55 l-76 -27 -126 42 -127 42 -124 -14 c-124 -14 -124 -14 -200 -66 -42
-28 -84 -51 -94 -51 -10 0 -66 10 -125 22 l-107 22 -113 -24 -113 -24 -69 -67
-69 -66 -123 58 -123 58 -133 -21 -133 -20 -81 26 c-64 21 -100 26 -177 26
-52 0 -98 -4 -101 -9 -3 -5 -43 -41 -90 -80 l-84 -71 -117 55 -117 55 -157 0
-157 0 -49 -50 c-27 -27 -53 -50 -58 -50 -4 0 -36 23 -70 50 l-62 50 -95 0
c-130 0 -211 -30 -323 -122 -46 -37 -86 -63 -92 -59 -5 5 -60 47 -122 95
l-112 86 -80 0 c-72 0 -92 -5 -180 -41 l-99 -41 -38 26 c-36 24 -47 26 -150
26 -156 0 -245 -19 -327 -69 l-66 -40 -70 29 c-58 25 -84 30 -148 30 l-78 0
-130 -87 c-108 -72 -146 -92 -231 -118 -95 -30 -107 -37 -196 -113 -93 -79
-94 -81 -118 -157 -13 -42 -29 -79 -34 -83 -6 -4 -60 -23 -121 -43 -94 -30
-113 -40 -130 -67 -12 -18 -29 -31 -41 -32 -25 0 -77 -34 -150 -96 -47 -39
-53 -50 -68 -112 -10 -37 -20 -72 -24 -78 -4 -6 -39 -29 -77 -52 -58 -34 -82
-57 -132 -124 -60 -83 -60 -83 -76 -192 l-16 -109 -79 -81 c-78 -79 -81 -83
-107 -175 -28 -95 -28 -118 -9 -251 5 -29 -2 -47 -40 -106 -43 -67 -46 -74
-52 -166 -6 -88 -5 -99 15 -131 20 -33 21 -37 7 -104 -15 -69 -15 -72 12 -154
l27 -84 64 -21 65 -21 80 24 c44 13 82 23 83 23 2 0 -9 -19 -25 -42 -24 -35
-32 -61 -42 -144 l-13 -101 57 -123 56 -123 0 -135 0 -135 53 -95 c40 -74 64
-105 104 -136 29 -23 53 -46 53 -53 0 -6 -11 -43 -25 -81 l-25 -69 16 -114 15
-114 53 -53 53 -54 -40 -91 -39 -92 12 -70 c7 -38 30 -116 51 -173 22 -56 39
-108 39 -115 0 -7 -29 -59 -65 -115 l-65 -103 1 -112 c0 -62 6 -134 13 -162
l13 -50 -83 -85 -83 -85 -12 -149 -13 -148 -83 -56 c-86 -57 -84 -55 -108
-153 -4 -16 3 -59 19 -111 14 -46 26 -90 26 -96 0 -7 -18 -36 -40 -65 -21 -29
-57 -96 -80 -150 -37 -90 -40 -103 -40 -193 l0 -97 56 -71 c31 -39 80 -93 109
-121 50 -48 54 -55 83 -161 24 -84 39 -178 62 -385 17 -151 39 -347 50 -436
13 -100 20 -225 20 -330 0 -92 5 -287 10 -432 l10 -265 37 -39 c21 -21 63 -54
95 -73 l56 -34 7 -63 c4 -34 16 -107 27 -162 25 -125 41 -144 151 -181 78 -26
82 -26 256 -19 174 7 177 8 244 42 l69 34 -7 37 c-6 36 -4 39 27 52 18 8 39
27 47 41 14 25 12 31 -61 145 -132 206 -202 418 -279 841 l-50 278 11 315 c14
387 37 553 103 728 l42 113 65 36 c119 66 114 60 135 172 10 56 21 101 24 101
18 -1 63 -192 81 -347 26 -219 25 -406 0 -753 -19 -256 -20 -284 -6 -432 18
-182 31 -217 108 -289 l49 -46 9 -104 c5 -57 13 -126 18 -154 12 -60 61 -245
68 -257 15 -23 170 -82 276 -105 l117 -24 131 20 c107 16 137 25 170 48 38 26
40 30 35 66 -4 28 -1 39 10 43 8 4 22 30 31 60 l15 53 -99 148 c-135 202 -187
338 -241 632 l-38 206 8 320 c7 319 29 877 34 883 2 2 40 -2 86 -9 l83 -12 78
84 c117 125 111 109 84 217 -27 105 -34 99 81 77 43 -8 79 -15 81 -15 2 0 33
61 68 135 l65 136 -19 100 c-11 55 -16 101 -13 103 3 1 43 13 88 26 l83 23 56
106 57 106 -31 118 -30 118 88 44 c80 40 90 48 95 77 9 58 25 163 25 171 0 4
6 7 13 7 6 0 30 -30 52 -66 34 -56 49 -70 99 -96 58 -29 59 -29 130 -17 39 7
92 23 118 36 26 12 52 23 58 23 6 0 56 -29 113 -64 100 -63 104 -65 202 -77
l100 -12 72 37 c40 20 78 36 86 36 7 0 28 -16 47 -35 19 -19 64 -53 101 -75
64 -38 72 -40 148 -40 73 0 89 4 151 35 38 19 73 35 78 35 5 0 30 -16 55 -35
46 -35 46 -35 151 -35 162 0 202 11 257 72 l46 50 71 -36 c64 -32 80 -36 150
-36 l78 0 49 50 c27 28 53 50 58 50 5 0 46 -22 92 -50 46 -27 89 -50 96 -50 7
0 55 12 107 27 86 25 97 31 119 65 l25 37 78 -39 78 -39 125 38 c70 21 129 36
132 33 3 -3 5 -24 5 -46 0 -37 6 -47 66 -107 l67 -67 -27 -109 -27 -109 42
-97 c40 -95 60 -120 142 -184 l29 -22 -65 -123 -65 -123 14 -100 14 -100 57
-57 c36 -37 76 -65 109 -79 61 -24 54 -3 84 -239 26 -206 50 -600 50 -836 0
-107 -9 -293 -20 -424 -43 -503 -62 -908 -44 -955 8 -20 67 -50 126 -65 l45
-12 14 -71 c7 -40 29 -128 49 -197 l36 -125 71 -41 c65 -37 87 -43 235 -68
l163 -26 115 28 c115 28 200 69 200 96 0 7 -7 19 -15 26 -19 16 -19 40 0 40 8
0 26 20 41 45 l26 46 -44 67 c-25 37 -67 107 -93 156 -27 49 -56 97 -64 106
-9 9 -41 54 -72 101 -47 70 -64 110 -97 220 -93 306 -90 288 -97 574 -8 314 9
518 86 1020 55 358 108 587 144 620 12 11 42 56 65 100 37 67 43 87 41 132
l-1 53 47 -7 c93 -12 96 -14 115 -79 30 -100 96 -421 119 -579 19 -138 21
-177 16 -490 -4 -187 -13 -461 -21 -609 l-14 -269 45 -67 c25 -39 72 -90 109
-120 l64 -52 0 -66 c0 -37 5 -87 11 -111 5 -24 12 -69 14 -100 3 -31 15 -99
26 -152 l22 -96 60 -48 c58 -47 64 -49 216 -81 l156 -33 124 22 c118 21 125
24 149 55 23 30 24 37 14 64 -10 28 -9 34 19 66 17 19 29 42 26 51 -2 10 -45
78 -94 152 -149 223 -175 278 -236 504 -36 130 -68 278 -91 423 -33 202 -36
243 -36 420 0 231 28 610 70 942 16 129 31 259 34 288 3 38 18 78 55 146 44
81 53 108 66 196 l15 102 -61 69 c-33 38 -59 73 -57 79 1 5 34 29 72 52 l69
43 33 120 c18 66 33 127 34 135 0 8 -25 40 -56 71 l-56 56 65 76 65 76 -24
113 c-13 62 -30 132 -38 156 l-13 42 33 20 c18 12 54 48 81 80 43 53 51 71 73
166 l25 106 98 41 c94 40 100 45 153 114 53 69 57 79 80 184 23 109 25 113 93
204 69 91 69 93 96 216 14 68 28 132 31 141 3 9 29 46 59 83 30 37 55 72 55
78 0 7 7 56 14 110 12 82 20 108 54 165 22 37 72 124 111 194 l71 128 0 135 0
134 75 51 c41 28 80 60 86 71 25 48 57 160 69 244 11 79 20 103 72 197 l59
107 -2 102 -2 103 64 41 c109 70 164 156 281 434 55 130 122 287 150 350 39
89 53 136 64 210 8 53 14 101 14 108 0 6 31 49 70 95 l70 83 0 85 c0 47 4 91
9 99 10 16 31 15 439 -20 l263 -22 102 23 c56 12 118 30 137 40 19 10 66 21
103 25 l69 7 86 111 c48 61 110 139 139 173 28 34 57 80 64 102 10 36 9 45 -9
81 -12 21 -46 102 -77 178 -46 112 -362 702 -487 910 l-19 32 104 70 c95 64
111 79 171 165 36 52 66 101 66 108 0 27 -58 57 -219 114 -91 32 -165 64 -168
72 -4 8 1 78 9 156 l16 141 -41 69 c-28 47 -50 72 -67 77 -14 4 -46 12 -71 19
l-46 12 -11 76 c-11 69 -17 82 -71 151 l-59 76 -102 28 -102 28 -65 -26 -65
-26 -36 23 c-21 12 -76 48 -124 80 l-87 58 -103 0 -103 0 -65 -42z" />
        </g>
      </svg>
    );
  }
  if (icon === "wheat") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.2109 8.78899L3.4653 20.5347M8.90748 15.0925L9.10982 14.9292C9.30611 14.7589 9.48392 14.5681 9.64012 14.3598C10.854 12.7413 10.526 10.4451 8.90748 9.23119L8.70514 9.39448C8.50885 9.56474 8.33104 9.75557 8.17484 9.96383C6.96092 11.5824 7.28893 13.8786 8.90748 15.0925ZM8.90748 15.0925L9.07078 15.2948C9.24104 15.4911 9.43188 15.6689 9.64016 15.8252C11.2587 17.039 13.5548 16.711 14.7687 15.0925L14.6054 14.8901C14.4352 14.6938 14.2443 14.516 14.036 14.3598C12.4175 13.1459 10.1214 13.4739 8.90748 15.0925ZM11.8381 12.1618L12.0404 11.9985C12.2367 11.8283 12.4145 11.6375 12.5707 11.4292C13.7847 9.81064 13.4566 7.51447 11.8381 6.30055L11.6358 6.46384C11.4395 6.6341 11.2617 6.82492 11.1055 7.03319C9.89154 8.65174 10.2195 10.9479 11.8381 12.1618ZM11.8381 12.1618L12.0014 12.3642C12.1717 12.5605 12.3625 12.7383 12.5708 12.8945C14.1893 14.1084 16.4854 13.7804 17.6993 12.1618L17.536 11.9595C17.3658 11.7632 17.1749 11.5854 16.9667 11.4292C15.3481 10.2153 13.052 10.5433 11.8381 12.1618ZM14.7687 9.23119L14.9711 9.0679C15.1673 8.89764 15.3452 8.70682 15.5014 8.49855C16.7153 6.88 16.3873 4.58383 14.7687 3.36991L14.5664 3.5332C14.3701 3.70346 14.1923 3.89428 14.0361 4.10255C12.8222 5.7211 13.1502 8.01727 14.7687 9.23119ZM14.7687 9.23119L14.932 9.43354C15.1023 9.62984 15.2931 9.80766 15.5014 9.96387C17.1199 11.1778 19.4161 10.8497 20.6299 9.23119L20.4667 9.02885C20.2964 8.83254 20.1056 8.65473 19.8973 8.49852C18.2787 7.28463 15.9826 7.61266 14.7687 9.23119ZM5.90748 18.0925L6.10982 17.9292C6.30611 17.7589 6.48392 17.5681 6.64012 17.3598C7.85405 15.7413 7.52603 13.4451 5.90748 12.2312L5.70514 12.3945C5.50885 12.5647 5.33104 12.7556 5.17484 12.9638C3.96092 14.5824 4.28893 16.8786 5.90748 18.0925ZM5.90748 18.0925L6.07078 18.2948C6.24104 18.4911 6.43188 18.6689 6.64016 18.8252C8.25869 20.039 10.5548 19.711 11.7687 18.0925L11.6054 17.8901C11.4352 17.6938 11.2443 17.516 11.036 17.3598C9.41751 16.1459 7.12137 16.4739 5.90748 18.0925ZM17.6292 7.40757C17.3714 7.44439 17.1108 7.45359 16.8516 7.43518L16.593 7.40753C16.3069 5.40469 17.6986 3.54913 19.7014 3.26301C20.045 3.21392 20.3939 3.21392 20.7375 3.26301C21.0237 5.26589 19.632 7.12145 17.6292 7.40757Z" />
      </svg>
    );
  }
  if (icon === "wheat") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.2109 8.78899L3.4653 20.5347M8.90748 15.0925L9.10982 14.9292C9.30611 14.7589 9.48392 14.5681 9.64012 14.3598C10.854 12.7413 10.526 10.4451 8.90748 9.23119L8.70514 9.39448C8.50885 9.56474 8.33104 9.75557 8.17484 9.96383C6.96092 11.5824 7.28893 13.8786 8.90748 15.0925ZM8.90748 15.0925L9.07078 15.2948C9.24104 15.4911 9.43188 15.6689 9.64016 15.8252C11.2587 17.039 13.5548 16.711 14.7687 15.0925L14.6054 14.8901C14.4352 14.6938 14.2443 14.516 14.036 14.3598C12.4175 13.1459 10.1214 13.4739 8.90748 15.0925ZM11.8381 12.1618L12.0404 11.9985C12.2367 11.8283 12.4145 11.6375 12.5707 11.4292C13.7847 9.81064 13.4566 7.51447 11.8381 6.30055L11.6358 6.46384C11.4395 6.6341 11.2617 6.82492 11.1055 7.03319C9.89154 8.65174 10.2195 10.9479 11.8381 12.1618ZM11.8381 12.1618L12.0014 12.3642C12.1717 12.5605 12.3625 12.7383 12.5708 12.8945C14.1893 14.1084 16.4854 13.7804 17.6993 12.1618L17.536 11.9595C17.3658 11.7632 17.1749 11.5854 16.9667 11.4292C15.3481 10.2153 13.052 10.5433 11.8381 12.1618ZM14.7687 9.23119L14.9711 9.0679C15.1673 8.89764 15.3452 8.70682 15.5014 8.49855C16.7153 6.88 16.3873 4.58383 14.7687 3.36991L14.5664 3.5332C14.3701 3.70346 14.1923 3.89428 14.0361 4.10255C12.8222 5.7211 13.1502 8.01727 14.7687 9.23119ZM14.7687 9.23119L14.932 9.43354C15.1023 9.62984 15.2931 9.80766 15.5014 9.96387C17.1199 11.1778 19.4161 10.8497 20.6299 9.23119L20.4667 9.02885C20.2964 8.83254 20.1056 8.65473 19.8973 8.49852C18.2787 7.28463 15.9826 7.61266 14.7687 9.23119ZM5.90748 18.0925L6.10982 17.9292C6.30611 17.7589 6.48392 17.5681 6.64012 17.3598C7.85405 15.7413 7.52603 13.4451 5.90748 12.2312L5.70514 12.3945C5.50885 12.5647 5.33104 12.7556 5.17484 12.9638C3.96092 14.5824 4.28893 16.8786 5.90748 18.0925ZM5.90748 18.0925L6.07078 18.2948C6.24104 18.4911 6.43188 18.6689 6.64016 18.8252C8.25869 20.039 10.5548 19.711 11.7687 18.0925L11.6054 17.8901C11.4352 17.6938 11.2443 17.516 11.036 17.3598C9.41751 16.1459 7.12137 16.4739 5.90748 18.0925ZM17.6292 7.40757C17.3714 7.44439 17.1108 7.45359 16.8516 7.43518L16.593 7.40753C16.3069 5.40469 17.6986 3.54913 19.7014 3.26301C20.045 3.21392 20.3939 3.21392 20.7375 3.26301C21.0237 5.26589 19.632 7.12145 17.6292 7.40757Z" />
      </svg>
    );
  }
  return <span className={cn("material-symbols-outlined", className)}>{icon}</span>;
}

const L = {
  en: {
    chairman: "CHAIRMAN", song: "Song & Prayer", openingCmt: "Opening Comments",
    min: "min.", addPart: "Add Part", done: "Done",
    namePlaceholder: "Name", remove: "Remove", removeConfirm: "Remove this part?",
    master: "Active timer", current: "Now", start: "Start", pause: "Pause",
    resume: "Resume", reset: "Reset", skip: "Next", timer: "Timer",
    assignee: "Assignee", presiding: "Presiding", reader: "Reader", conductor: "Conductor",
    stop: "Stop",
    overtime: "Overtime", complete: "Complete", restart: "Restart",
     totalTime: "Total", sessionLog: "Session Log", logEmpty: "No parts timed yet.", end: "End", editLog: "Edit log", deleteLog: "Delete log", save: "Save", cancel: "Cancel",
     saving: "Saving", saved: "Saved", offline: "Offline — saved locally", saveError: "Save error", resetUnsaved: "Reset unsaved time",
    noSections: "No parts. Reset in Settings.", 
    weekLabel: "Week", newWeek: "New Week", deleteWeek: "Delete Week",
    deleteWeekConfirm: "Delete this week's program?",
    congrats: "Congregation Bible Study", concluding: "Concluding Comments", edit: "Edit",
    legend: "Timer legend", activeRole: "Active", assigneeRole: "Assignee / Reader", presidingRole: "Presiding / Conductor",
  },
  es: {
    chairman: "PRESIDENTE", song: "Canción y Oración", openingCmt: "Palabras de introducción",
    min: "min.", addPart: "Agregar Parte", done: "Listo",
    namePlaceholder: "Nombre", remove: "Eliminar", removeConfirm: "¿Eliminar esta parte?",
    master: "Temporizador activo", current: "Ahora", start: "Iniciar", pause: "Pausar",
    resume: "Reanudar", reset: "Reiniciar", skip: "Sig.", timer: "Temporizador",
    assignee: "Asignado", presiding: "Presidente", reader: "Lector", conductor: "Conductor",
    stop: "Detener",
    overtime: "Excedido", complete: "Completa", restart: "Reiniciar",
      totalTime: "Total", sessionLog: "Registro", logEmpty: "Aún no se ha medido ninguna parte.", end: "Fin", editLog: "Editar registro", deleteLog: "Eliminar registro", save: "Guardar", cancel: "Cancelar",
     saving: "Guardando", saved: "Guardado", offline: "Sin conexión — guardado localmente", saveError: "Error al guardar", resetUnsaved: "Restablecer tiempo sin guardar",
    noSections: "No hay partes. Restablecer en Configuración.",
    weekLabel: "Semana", newWeek: "Nueva Semana", deleteWeek: "Eliminar Semana",
    deleteWeekConfirm: "¿Eliminar el programa de esta semana?",
    congrats: "Estudio Bíblico de la Congregación", concluding: "Palabras de conclusión", edit: "Editar",
    legend: "Leyenda de temporizadores", activeRole: "Activo", assigneeRole: "Asignado / Lector", presidingRole: "Presidente / Conductor",
  },
};

/* ---------- ascending role timers ---------- */

interface TimerRecord {
  persistedSec: number;
  unsavedSec: number;
}

interface ActiveTimer {
  key: string;
  sectionId: string;
  role: TimerRole | null;
  startedAtISO: string;
  startedAtMs: number;
  titleEn: string;
  titleEs: string;
  scheduledDurationMin: number;
}

function timerKey(sectionId: string, role: TimerRole | null): string {
  return `${sectionId}:${role ?? "single"}`;
}

function logDurationSec(entry: TimerLogEntry): number {
  if (typeof entry.actualDurationSec === "number" && Number.isFinite(entry.actualDurationSec)) {
    return Math.max(0, Math.round(entry.actualDurationSec));
  }
  return Math.max(0, Math.round(entry.actualDurationMin * 60));
}

function hydrateTimerRecords(sessionLog: TimerLogEntry[], sessionHistory: MeetingSession[]): Record<string, TimerRecord> {
  const records: Record<string, TimerRecord> = {};
  const seen = new Set<string>();
  const entries = [
    ...sessionHistory.flatMap((session) => session.log),
    ...sessionLog,
  ];

  for (const entry of entries) {
    const durationSec = logDurationSec(entry);
    const identity = entry.id
      ? `id:${entry.id}`
      : `${entry.sectionId}:${entry.role ?? "single"}:${entry.actualStartISO}:${entry.actualEndISO}:${durationSec}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const key = timerKey(entry.sectionId, entry.role ?? null);
    const current = records[key] ?? { persistedSec: 0, unsavedSec: 0 };
    records[key] = { persistedSec: current.persistedSec + durationSec, unsavedSec: 0 };
  }

  return records;
}

function useProgramTimers(
  sections: PresidingSection[],
  sessionLog: TimerLogEntry[],
  sessionHistory: MeetingSession[],
  onLog: (entry: TimerLogEntry) => void,
) {
  const flat = useMemo(() => flattenAll(sections), [sections]);
  const hydratedRecords = useMemo(
    () => hydrateTimerRecords(sessionLog, sessionHistory),
    [sessionHistory, sessionLog],
  );
  const [records, setRecords] = useState<Record<string, TimerRecord>>(() => hydratedRecords);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const recordsR = useRef<Record<string, TimerRecord>>(records);
  const activeR = useRef<ActiveTimer | null>(null);
  const intvR = useRef<ReturnType<typeof setInterval> | null>(null);

  const commitRecords = useCallback((next: Record<string, TimerRecord>) => {
    recordsR.current = next;
    setRecords(next);
  }, []);

  const stopInterval = useCallback(() => {
    if (intvR.current) {
      clearInterval(intvR.current);
      intvR.current = null;
    }
  }, []);

  const refreshActive = useCallback(() => {
    const active = activeR.current;
    if (!active) return;
    const current = recordsR.current[active.key] ?? { persistedSec: 0, unsavedSec: 0 };
    const unsavedSec = Math.max(0, Math.floor((Date.now() - active.startedAtMs) / 1000));
    commitRecords({ ...recordsR.current, [active.key]: { ...current, unsavedSec } });
  }, [commitRecords]);

  const finalizeActive = useCallback(() => {
    const active = activeR.current;
    if (!active) return;
    stopInterval();
    const segmentSec = Math.max(0, Math.floor((Date.now() - active.startedAtMs) / 1000));
    const current = recordsR.current[active.key] ?? { persistedSec: 0, unsavedSec: 0 };
    const next = {
      ...recordsR.current,
      [active.key]: { persistedSec: current.persistedSec + segmentSec, unsavedSec: 0 },
    };
    activeR.current = null;
    setActiveKey(null);
    commitRecords(next);
    onLog({
      sectionId: active.sectionId,
      titleEn: active.titleEn,
      titleEs: active.titleEs,
      scheduledDurationMin: active.scheduledDurationMin,
      actualStartISO: active.startedAtISO,
      actualEndISO: new Date().toISOString(),
      actualDurationMin: Math.round(segmentSec / 60),
      actualDurationSec: segmentSec,
      role: active.role ?? undefined,
      wasOvertime: segmentSec > active.scheduledDurationMin * 60,
    });
  }, [commitRecords, onLog, stopInterval]);

  const toggleTimer = useCallback((sectionId: string, role: TimerRole | null) => {
    const item = flat.find((candidate) => candidate.sectionId === sectionId);
    if (!item) return;
    const key = timerKey(sectionId, role);
    if (activeR.current?.key === key) {
      finalizeActive();
      return;
    }

    if (activeR.current) finalizeActive();
    const startedAt = new Date();
    const active: ActiveTimer = {
      key,
      sectionId,
      role,
      startedAtISO: startedAt.toISOString(),
      startedAtMs: startedAt.getTime(),
      titleEn: item.titleEn,
      titleEs: item.titleEs,
      scheduledDurationMin: Math.round(item.durationSec / 60),
    };
    activeR.current = active;
    const current = recordsR.current[key] ?? { persistedSec: 0, unsavedSec: 0 };
    commitRecords({
      ...recordsR.current,
      [key]: { ...current, unsavedSec: 0 },
    });
    setActiveKey(key);
    intvR.current = setInterval(refreshActive, 1000);
  }, [commitRecords, finalizeActive, flat, refreshActive]);

  const resetTimer = useCallback((sectionId: string, role: TimerRole | null) => {
    const key = timerKey(sectionId, role);
    if (activeR.current?.key === key) {
      stopInterval();
      activeR.current = null;
      setActiveKey(null);
    }

    const current = recordsR.current[key];
    if (!current || current.unsavedSec === 0) return;
    commitRecords({ ...recordsR.current, [key]: { ...current, unsavedSec: 0 } });
  }, [commitRecords, stopInterval]);

  useEffect(() => {
    const active = activeR.current;
    const activeUnsavedSec = active ? recordsR.current[active.key]?.unsavedSec ?? 0 : 0;
    const next = { ...hydratedRecords };
    if (active) {
      const current = next[active.key] ?? { persistedSec: 0, unsavedSec: 0 };
      next[active.key] = { ...current, unsavedSec: activeUnsavedSec };
    }
    commitRecords(next);
  }, [commitRecords, hydratedRecords]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  const getTimerState = useCallback((sectionId: string, role: TimerRole | null) => {
    const key = timerKey(sectionId, role);
    const record = records[key];
    return {
      elapsedSec: record ? record.persistedSec + record.unsavedSec : 0,
      running: activeKey === key,
    };
  }, [activeKey, records]);

  const activeItem = activeR.current ? flat.find((item) => item.sectionId === activeR.current?.sectionId) : null;
  const activeTimer = activeR.current && activeItem ? {
    ...activeR.current,
    titleEn: activeItem.titleEn,
    titleEs: activeItem.titleEs,
    elapsedSec: (() => {
      const record = records[activeR.current.key];
      return record ? record.persistedSec + record.unsavedSec : 0;
    })(),
  } : null;

  return { getTimerState, toggleTimer, resetTimer, stopActive: finalizeActive, activeTimer };
}

/* ---------- main component ---------- */

interface Props {
  lang: "en" | "es"; config: PresidingConfig; prefs: PresidingPrefs;
  sessionLog: TimerLogEntry[]; sessionHistory?: MeetingSession[]; onConfigChange: (cfg: PresidingConfig) => void; onLogEntry: (entry: TimerLogEntry) => void;
   onDeleteLog?: (logId: string) => void;
  onUpdateLog?: (logId: string, patch: Partial<TimerLogEntry>) => void;
}

export default function ProgramView({ lang, config, prefs, sessionLog, sessionHistory = [], onConfigChange, onLogEntry, onDeleteLog, onUpdateLog }: Props) {
  const isEs = lang === "es"; const lbl = L[lang];

  const activeWeek = useMemo(() =>
    config?.weeks?.find((w) => w.weekId === config.activeWeekId) ?? config?.weeks?.[0], [config]);
  const sections = activeWeek?.sections ?? [];
  const catalogEntry = activeWeek ? getJwWolWeekCatalogEntry(activeWeek.weekId) : undefined;
  const weekRangeEn = catalogEntry?.weekRangeEn ?? activeWeek?.weekRangeEn ?? "";
  const weekRangeEs = catalogEntry?.weekRangeEs ?? activeWeek?.weekRangeEs ?? "";
  const bibleReading = catalogEntry?.bibleReading ?? activeWeek?.bibleReading ?? "";

  const updateActiveWeek = useCallback((fn: (w: ProgramWeek) => ProgramWeek) => {
    if (!config || !activeWeek) return;
    onConfigChange({ ...config, weeks: config.weeks.map(w => w.weekId === activeWeek.weekId ? fn(w) : w) });
  }, [config, activeWeek, onConfigChange]);

  // Week management
  const [showWeekMenu, setShowWeekMenu] = useState(false);
  const weekDisplay = isEs ? (weekRangeEs || weekRangeEn) : (weekRangeEn || weekRangeEs);

  const switchWeek = (weekId: string) => {
    onConfigChange({ ...config, activeWeekId: weekId });
    setShowWeekMenu(false);
  };
  const createWeek = () => {
    const def = getDefaultWeek();
    const id = `w${Date.now()}`;
    onConfigChange({ weeks: [...config.weeks, { ...def, weekId: id }], activeWeekId: id });
    setShowWeekMenu(false);
  };
  const deleteWeek = () => {
    if (config.weeks.length <= 1) return;
    if (!window.confirm(lbl.deleteWeekConfirm)) return;
    const remaining = config.weeks.filter(w => w.weekId !== activeWeek!.weekId);
    onConfigChange({ weeks: remaining, activeWeekId: remaining[0]?.weekId ?? null });
    setShowWeekMenu(false);
  };

  // Inline editing state
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [inlineField, setInlineField] = useState<"title" | "assignee" | "duration" | "start" | "end" | null>(null);

  const updateSection = (id: string, fn: (s: PresidingSection) => PresidingSection) => {
    const walk = (list: PresidingSection[]): PresidingSection[] => list.map(s => {
      if (s.id === id) return fn({ ...s });
      if (s.subsections.some(sub => sub.id === id)) return { ...s, subsections: walk(s.subsections) };
      return s;
    });
    updateActiveWeek((w) => ({ ...w, sections: walk(w.sections) }));
  };

  const removeSection = (id: string) => {
    if (!window.confirm(lbl.removeConfirm)) return;
    const walk = (list: PresidingSection[]): PresidingSection[] => list
      .filter(s => s.id !== id)
      .map(s => ({ ...s, subsections: s.subsections.some(sub => sub.id === id) ? s.subsections.filter(sub => sub.id !== id) : walk(s.subsections) }));
    updateActiveWeek((w) => ({ ...w, sections: walk(w.sections) }));
    if (inlineId === id) setInlineId(null);
  };

  const addSubsection = (parentId: string, group: SectionGroup) => {
    updateActiveWeek((w) => ({
      ...w,
      sections: w.sections.map(s => s.id === parentId ? { ...s, subsections: [...s.subsections, createPresidingSection("", "", 5, group)] } : s),
    }));
  };

  const addTopSection = () => {
    updateActiveWeek((w) => ({ ...w, sections: [...w.sections, createPresidingSection("", "", 10)] }));
  };

  // Find editing section
  let editingSection: PresidingSection | null = null;
  if (inlineId) {
    for (const s of sections) {
      if (s.id === inlineId) { editingSection = s; break; }
      for (const sub of s.subsections) { if (sub.id === inlineId) { editingSection = sub; break; } }
      if (editingSection) break;
    }
  }

  const totalMin = totalPresidingMinutes(sections);
  const clock = (m: number) => fmtClock(m, prefs.timeFormat === "24h");
  const startMinTotal = prefs.meetingStartHour * 60 + prefs.meetingStartMinute;

  let legacyOffset = 0; const startTimes: number[] = []; const endTimes: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.subsections.length > 0) {
        for (const sub of s.subsections) {
          const offset = sub.scheduledStartMinute ?? legacyOffset;
          const endOffset = sub.scheduledEndMinute ?? (offset + sub.duration);
          startTimes.push(startMinTotal + offset);
          endTimes.push(startMinTotal + endOffset);
          legacyOffset = Math.max(legacyOffset, endOffset);
      }
    } else {
      const offset = s.scheduledStartMinute ?? legacyOffset;
      const endOffset = s.scheduledEndMinute ?? (offset + s.duration);
      startTimes.push(startMinTotal + offset);
      endTimes.push(startMinTotal + endOffset);
      legacyOffset = Math.max(legacyOffset, endOffset);
    }
    // Song & Prayer offset: first timed part after opening starts 5 min later
    if (i === 0) legacyOffset += 5;
  }

  const timer = useProgramTimers(sections, sessionLog, sessionHistory, onLogEntry);
  const { getTimerState, toggleTimer, resetTimer, stopActive, activeTimer } = timer;

  if (sections.length === 0) {
    return <div className="flex items-center justify-center h-full"><p className="text-sm text-slate-500">{lbl.noSections}</p></div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-canvas overflow-hidden">
      {/* ===== HEADER: Week selector + info ===== */}
      <div className="shrink-0 px-4 pt-4 pb-2 space-y-3">
        {/* Week selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <button onClick={() => setShowWeekMenu(!showWeekMenu)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-surface px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="truncate">{lbl.weekLabel}: {weekDisplay || activeWeek?.weekId}</span>
              <span className="material-symbols-outlined text-base text-slate-400">{showWeekMenu ? "expand_less" : "expand_more"}</span>
            </button>
            {showWeekMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1 max-h-48 overflow-y-auto">
                {config.weeks.map(w => (
                  <button key={w.weekId} onClick={() => switchWeek(w.weekId)}
                    className={cn("w-full text-left px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                      w.weekId === activeWeek?.weekId ? "text-primary bg-primary/5" : "text-slate-600 dark:text-slate-300")}>
                    {isEs ? (w.weekRangeEs || w.weekId) : (w.weekRangeEn || w.weekId)}
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  <button onClick={createWeek}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
                    + {lbl.newWeek}
                  </button>
                  {config.weeks.length > 1 && (
                    <button onClick={deleteWeek}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                      {lbl.deleteWeek}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Stop the one active timer without competing intervals. */}
          <button onClick={stopActive} disabled={!activeTimer}
            className={cn("shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all",
              activeTimer ? "bg-amber-500 active:scale-95" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed")}>
            <span className="material-symbols-outlined text-xl">{activeTimer ? "stop" : "timer"}</span>
          </button>
        </div>
        <div className="flex justify-end">
          <SaveStatus lbl={lbl} />
        </div>

        {/* Week info is catalog-driven; only the selector above changes weeks. */}
        <div className="text-center">
          <div className="space-y-0.5">
            <h2 className="text-lg font-black tracking-wide text-slate-800 dark:text-slate-100">{weekDisplay}</h2>
            {bibleReading && <p className="text-[11px] font-semibold tracking-wider text-slate-400">{bibleReading}</p>}
          </div>
        </div>
      </div>

      {/* ===== ACTIVE TIMER BAR ===== */}
      {activeTimer && (
        <div className="shrink-0 sticky top-0 z-40 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-surface/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500 animate-pulse" />
            <div className="text-center shrink-0 min-w-[3.5rem]">
              <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">{lbl.master}</p>
              <p className="font-mono text-sm font-bold tabular-nums">{fmtTime(activeTimer.elapsedSec)}</p>
            </div>
            <div className="flex-1 min-w-0 text-center">
              <p className="text-[8px] uppercase tracking-wider font-bold truncate text-emerald-600">{lbl.current}</p>
              <p className="font-mono text-xs font-bold tabular-nums truncate text-slate-700 dark:text-slate-200">
                {isEs ? (activeTimer.titleEs || activeTimer.titleEn) : (activeTimer.titleEn || activeTimer.titleEs)}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-500">
              {activeTimer.role ? (activeTimer.role === "assignee" ? lbl.assignee : lbl.presiding) : lbl.timer}
            </span>
            <button onClick={stopActive} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black active:scale-95">{lbl.stop}</button>
          </div>
        </div>
      )}

      {/* ===== PROGRAM BODY ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-6 space-y-4">
        <TimerLegend isEs={isEs} lbl={lbl} />

        {/* Opening section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{lbl.chairman}:</p>
              <input value={sections[0]?.assigneeName || ""}
                onChange={e => updateSection(sections[0]?.id ?? "", s => ({ ...s, assigneeName: e.target.value }))}
                placeholder="————" className="w-full bg-transparent text-sm italic text-slate-500 dark:text-slate-400 focus:outline-none border-b border-dashed border-slate-200 dark:border-slate-700 pb-0.5" />
            </div>
            <TimerButton role={null} label={lbl.timer}
               {...getTimerState(sections[0]?.id ?? "", null)}
               onClick={() => toggleTimer(sections[0]?.id ?? "", null)}
               onReset={() => resetTimer(sections[0]?.id ?? "", null)}
               actionLabels={lbl} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{lbl.song}</span>
            <span>{lbl.openingCmt} ({sections[0]?.duration ?? 1} {lbl.min})</span>
          </div>
        </div>

        {/* Main sections */}
        {(() => {
          let partNum = 1; let intIdx = 1; // skip opening (index 0)
          const cards: React.ReactNode[] = [];

          for (let i = 1; i < sections.length; i++) {
            const sec = sections[i];
            const grp = sec.group;
            const isGroup = sec.subsections.length > 0;
            const col = grp ? SECTION_COLORS[grp] : "#2B579A";
            const icon = grp ? SECTION_ICONS[grp] : null;
            const isConc = !isGroup && sec.titleEn?.toLowerCase().includes("concluding");

            if (isConc) {
              cards.push(
                <div key={sec.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {isEs ? (sec.titleEs || sec.titleEn) : (sec.titleEn || sec.titleEs)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{sec.duration} {lbl.min} · ♫ {lbl.song}</p>
                    </div>
                     <TimerButton role={null} label={lbl.timer}
                       {...getTimerState(sec.id, null)}
                       onClick={() => toggleTimer(sec.id, null)}
                       onReset={() => resetTimer(sec.id, null)}
                       actionLabels={lbl} />
                  </div>
                </div>
              );
              intIdx++;
              continue;
            }

            if (isGroup && grp) {
              cards.push(
                <div key={sec.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface shadow-sm overflow-hidden">
                  {/* Group header */}
                  <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: col + "40" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: col }}>
                      <SectionIcon icon={icon} className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: col }}>
                        {isEs ? (sec.titleEs || sec.titleEn) : (sec.titleEn || sec.titleEs)}
                      </h3>
                    </div>
                    <button onClick={() => removeSection(sec.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  {/* Subsections */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sec.subsections.map(sub => {
                      const flatIdx = intIdx++; const num = partNum++;
                      const timerRoles = getTimerRoles(sub, grp);
                      return <InterventionRow key={sub.id} num={num} section={sub} color={col}
                         startTime={clock(startTimes[flatIdx] ?? 0)} endTime={clock(endTimes[flatIdx] ?? 0)} meetingStartMinute={startMinTotal} timerRoles={timerRoles}
                        getTimerState={getTimerState} isEs={isEs} lbl={lbl}
                        inlineId={inlineId} inlineField={inlineField}
                        onTap={() => { setInlineId(sub.id); setInlineField("title"); }}
                        onEditField={(f) => { setInlineId(sub.id); setInlineField(f); }}
                        onClose={() => setInlineId(null)}
                         onUpdate={(fn) => updateSection(sub.id, fn)}
                         onRemove={() => removeSection(sub.id)}
                         onToggleTimer={(role) => toggleTimer(sub.id, role)}
                         onResetTimer={(role) => resetTimer(sub.id, role)} />;
                    })}
                  </div>
                  {/* Add part */}
                  <button onClick={() => addSubsection(sec.id, grp)}
                    className="w-full py-2 text-center text-xs font-medium text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors border-t border-slate-100 dark:border-slate-800">
                    + {lbl.addPart}
                  </button>
                </div>
              );
            } else {
              // Standalone section (no group)
              const flatIdx = intIdx++; const num = partNum++;
              const timerRoles = getTimerRoles(sec);
              cards.push(
                <InterventionRow key={sec.id} num={num} section={sec} color={col}
                   startTime={clock(startTimes[flatIdx] ?? 0)} endTime={clock(endTimes[flatIdx] ?? 0)} meetingStartMinute={startMinTotal} timerRoles={timerRoles}
                  getTimerState={getTimerState} isEs={isEs} lbl={lbl}
                  inlineId={inlineId} inlineField={inlineField}
                  onTap={() => { setInlineId(sec.id); setInlineField("title"); }}
                  onEditField={(f) => { setInlineId(sec.id); setInlineField(f); }}
                  onClose={() => setInlineId(null)}
                   onUpdate={(fn) => updateSection(sec.id, fn)}
                   onRemove={() => removeSection(sec.id)}
                   onToggleTimer={(role) => toggleTimer(sec.id, role)}
                   onResetTimer={(role) => resetTimer(sec.id, role)}
                   standalone />
              );
            }
          }
          return cards;
        })()}

        {/* Add section */}
        <button onClick={addTopSection}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-3 text-sm font-medium text-slate-400 hover:border-primary hover:text-primary transition-colors text-center">
          + {isEs ? "Agregar Sección" : "Add Section"}
        </button>

        {/* Totals */}
        <p className="text-center text-xs text-slate-400 pt-1">
          {lbl.totalTime}: {totalMin} {lbl.min} · {clock(startMinTotal)} → {clock(startMinTotal + totalMin)}
        </p>
      </div>

      {/* ===== SESSION REVIEW ===== */}
      <SessionReview sessionLog={sessionLog} sessionHistory={sessionHistory} prefs={prefs} isEs={isEs} lbl={lbl}
        onDeleteLog={onDeleteLog} onUpdateLog={onUpdateLog} />
    </div>
  );
}

function isBibleReading(section: Pick<PresidingSection, "id" | "titleEn" | "titleEs">): boolean {
  const titles = [section.titleEn, section.titleEs].map((title) => title.trim().toLocaleLowerCase());
  return section.id === "def_reading" || titles.includes("bible reading") || titles.includes("lectura de la biblia");
}

function roleLabel(role: TimerRole | null, section: PresidingSection, lbl: typeof L.en): string {
  if (!role) return lbl.timer;
  if (isBibleReading(section)) return role === "assignee" ? lbl.reader : lbl.conductor;
  return role === "assignee" ? lbl.assignee : lbl.presiding;
}

function SaveStatus({ lbl }: { lbl: typeof L.en }) {
  const { status, error, isOnline } = useSync();
  const hasPendingChanges = useStore((state) => state.syncMetadata.hasPendingChanges);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isSaving = mounted && isOnline && (status === "syncing" || hasPendingChanges);
  const isError = mounted && isOnline && status === "error";
  const isOffline = mounted && !isOnline;
  const icon = isSaving ? "sync" : isError ? "error" : isOffline ? "cloud_off" : "cloud_done";
  const text = isSaving ? lbl.saving : isError ? lbl.saveError : isOffline ? lbl.offline : lbl.saved;

  return (
    <div role="status" aria-live="polite" title={isError ? (error ?? lbl.saveError) : text}
      className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold", isError ? "text-red-500" : isOffline ? "text-amber-600" : isSaving ? "text-primary" : "text-emerald-600")}>
      <span className={cn("material-symbols-outlined text-sm", isSaving && "animate-spin")}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function TimerButton({ role, label, elapsedSec, running, onClick, onReset, actionLabels }: {
  role: TimerRole | null; label: string; elapsedSec: number; running: boolean;
  onClick: () => void; onReset: () => void;
  actionLabels: Pick<typeof L.en, "start" | "resume" | "stop" | "reset" | "resetUnsaved">;
}) {
  const presiding = role === "presiding";
  const actionLabel = running ? actionLabels.stop : elapsedSec > 0 ? actionLabels.resume : actionLabels.start;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }}
        className={cn(
          "size-12 sm:size-14 rounded-full flex flex-col items-center justify-center gap-0 shadow-sm transition-all active:scale-95 shrink-0",
          running ? "bg-amber-500 text-black" : presiding ? "bg-violet-600" : "bg-primary",
          !running && (presiding ? "active:bg-violet-800" : "active:bg-primary/80"),
        )}
        aria-label={`${label} ${actionLabel}`} aria-pressed={running}>
        <span className="material-symbols-outlined text-xs sm:text-sm leading-none">{running ? "stop" : "play_arrow"}</span>
        <span className="font-mono text-[10px] sm:text-[11px] font-bold leading-none tabular-nums">{fmtTime(elapsedSec)}</span>
      </button>
      <button type="button" onClick={(event) => { event.stopPropagation(); onReset(); }}
        className="size-11 rounded-full border border-slate-200 bg-surface text-slate-400 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 active:scale-95 dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950/20"
        aria-label={`${actionLabels.resetUnsaved}: ${label}`} title={actionLabels.resetUnsaved}>
        <span className="material-symbols-outlined text-base leading-none">restart_alt</span>
      </button>
    </div>
  );
}

function TimerLegend({ isEs, lbl }: { isEs: boolean; lbl: typeof L.en }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] font-semibold text-slate-400">
      <span className="uppercase tracking-wider">{lbl.legend}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary" />{isEs ? lbl.assigneeRole : lbl.assigneeRole}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-violet-600" />{isEs ? lbl.presidingRole : lbl.presidingRole}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" />{lbl.activeRole}</span>
    </div>
  );
}

/* ---------- InterventionRow (card-based) ---------- */

function InterventionRow({
  num, section, color, startTime, endTime, meetingStartMinute, timerRoles, getTimerState, isEs, lbl,
  inlineId, inlineField, onTap, onEditField, onClose, onUpdate, onRemove, onToggleTimer, onResetTimer,
  standalone = false,
}: {
  num: number; section: PresidingSection; color: string; startTime: string; endTime: string; meetingStartMinute: number;
  timerRoles: TimerRole[];
  getTimerState: (sectionId: string, role: TimerRole | null) => { elapsedSec: number; running: boolean };
  isEs: boolean; lbl: typeof L.en;
  inlineId: string | null; inlineField: "title" | "assignee" | "duration" | "start" | "end" | null;
  onTap: () => void; onEditField: (f: "title" | "assignee" | "duration" | "start" | "end") => void;
  onClose: () => void; onUpdate: (fn: (s: PresidingSection) => PresidingSection) => void;
  onRemove: () => void; onToggleTimer: (role: TimerRole | null) => void; onResetTimer: (role: TimerRole | null) => void;
  standalone?: boolean;
}) {
  const isThisInline = inlineId === section.id;
  const title = isEs ? (section.titleEs || section.titleEn || "") : (section.titleEn || section.titleEs || "");
  const startOffset = section.scheduledStartMinute ?? 0;
  const endOffset = section.scheduledEndMinute ?? (startOffset + section.duration);
  const startInput = (() => {
    const minute = (meetingStartMinute + startOffset) % (24 * 60);
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  })();
  const endInput = (() => {
    const minute = (meetingStartMinute + endOffset) % (24 * 60);
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  })();

  const wrapperClass = standalone
    ? "rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface shadow-sm"
    : "";

  return (
    <div className={cn("group relative", wrapperClass)}>
      {isThisInline ? (
        /* INLINE EDIT MODE */
        <div className={cn("p-4 space-y-3", standalone ? "" : "px-4 py-3")}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{lbl.edit}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          {/* Field tabs */}
          <div className="flex gap-1 flex-wrap">
            {(["title", "assignee", "duration", "start", "end"] as const).map(f => (
              <button key={f} onClick={() => onEditField(f)}
                className={cn("rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                  inlineField === f ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                   {f === "title" ? (isEs ? "ES/EN" : "EN/ES") : f === "assignee" ? (isEs ? "Nombre" : "Name") : f === "start" ? (isEs ? "Inicio" : "Start") : f === "end" ? lbl.end : lbl.min}
              </button>
            ))}
          </div>
          {/* Editor */}
          {inlineField === "duration" ? (
            <input type="number" min={1} max={120} value={section.duration}
              onChange={e => onUpdate(s => ({ ...s, duration: Math.max(1, parseInt(e.target.value) || 1) }))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          ) : inlineField === "start" ? (
            <input type="time" value={startInput}
              onChange={e => {
                const [hours, minutes] = e.target.value.split(":").map(Number);
                if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
                const target = hours * 60 + minutes;
                const offset = (target - meetingStartMinute + 24 * 60) % (24 * 60);
                onUpdate(s => ({ ...s, scheduledStartMinute: offset }));
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          ) : inlineField === "end" ? (
            <input type="time" value={endInput}
              onChange={e => {
                const [hours, minutes] = e.target.value.split(":").map(Number);
                if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
                const target = hours * 60 + minutes;
                const offset = (target - meetingStartMinute + 24 * 60) % (24 * 60);
                onUpdate(s => ({ ...s, scheduledEndMinute: Math.max(s.scheduledStartMinute ?? 0, offset) }));
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          ) : inlineField === "assignee" ? (
            <input type="text" value={section.assigneeName}
              onChange={e => onUpdate(s => ({ ...s, assigneeName: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={isEs ? "Nombre del hermano/a" : "Brother/Sister name"} autoFocus />
          ) : (
            <div className="space-y-2">
              <input type="text" value={section.titleEn}
                onChange={e => onUpdate(s => ({ ...s, titleEn: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="English title" />
              <input type="text" value={section.titleEs}
                onChange={e => onUpdate(s => ({ ...s, titleEs: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Título en español" />
            </div>
          )}
          <button onClick={onRemove}
            className="w-full rounded-lg border border-red-200 dark:border-red-800 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            {lbl.remove}
          </button>
        </div>
      ) : (
        /* DISPLAY MODE */
        <div className={cn("flex items-center gap-3", standalone ? "p-4" : "px-4 py-3")}
          onDoubleClick={onTap}>
          <span className="font-bold text-sm shrink-0 w-6" style={{ color }}>{num}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-bold text-sm truncate" style={{ color }}>{title}</span>
                <span className="text-xs text-slate-400 font-mono font-semibold shrink-0 whitespace-nowrap">{startTime} → {endTime}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-xs text-slate-400">{section.duration} {lbl.min}</span>
              {section.assigneeName && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-slate-500 dark:text-slate-400"
                  style={{ backgroundColor: color + "15" }}>
                  {section.assigneeName}
                </span>
              )}
            </div>
          </div>
          {/* Edit button — always visible */}
          <button onClick={(e) => { e.stopPropagation(); onTap(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            title={lbl.edit}>
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <div className={cn("flex shrink-0 gap-1.5", timerRoles.length > 1 ? "flex-col sm:flex-row" : "")}>
            {timerRoles.map((role) => {
              const state = getTimerState(section.id, role);
              return <TimerButton key={role} role={role} label={roleLabel(role, section, lbl)} {...state}
                onClick={() => onToggleTimer(role)} onReset={() => onResetTimer(role)} actionLabels={lbl} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Session Review ---------- */

function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function LogEditor({ entry, lbl, onCancel, onSave }: {
  entry: TimerLogEntry; lbl: typeof L.en;
  onCancel: () => void; onSave: (patch: Partial<TimerLogEntry>) => void;
}) {
  const [role, setRole] = useState<TimerRole | "none">(entry.role ?? "none");
  const [start, setStart] = useState(toLocalDateTimeInput(entry.actualStartISO));
  const [end, setEnd] = useState(toLocalDateTimeInput(entry.actualEndISO));
  const [scheduledDurationMin, setScheduledDurationMin] = useState(entry.scheduledDurationMin);
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      <label className="min-w-0 text-[11px] font-semibold">Role
        <select value={role} onChange={(event) => setRole(event.target.value as TimerRole | "none")} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700">
          <option value="none">{lbl.timer}</option><option value="assignee">{lbl.assignee}</option><option value="presiding">{lbl.presiding}</option>
        </select>
      </label>
      <label className="min-w-0 text-[11px] font-semibold">{lbl.min}
        <input type="number" min={0} max={240} value={scheduledDurationMin} onChange={(event) => setScheduledDurationMin(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <label className="min-w-0 text-[11px] font-semibold">Start
        <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <label className="min-w-0 text-[11px] font-semibold">{lbl.end}
        <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" onClick={() => onSave({ role: role === "none" ? undefined : role, actualStartISO: fromLocalDateTimeInput(start), actualEndISO: fromLocalDateTimeInput(end), scheduledDurationMin })} className="min-h-10 flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">{lbl.save}</button>
        <button type="button" onClick={onCancel} className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{lbl.cancel}</button>
      </div>
    </div>
  );
}

function SessionReview({ sessionLog, sessionHistory, prefs, isEs, lbl, onDeleteLog, onUpdateLog }: {
  sessionLog: TimerLogEntry[]; sessionHistory: MeetingSession[]; prefs: PresidingPrefs; isEs: boolean; lbl: typeof L.en;
  onDeleteLog?: (logId: string) => void;
  onUpdateLog?: (logId: string, patch: Partial<TimerLogEntry>) => void;
}) {
  const [show, setShow] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const reviewEntries = sessionHistory.length > 0
    ? sessionHistory.flatMap((session) => session.log.map((entry) => ({ entry, date: session.date })))
    : sessionLog.map((entry) => ({ entry, date: "" }));
  const roleName = (entry: TimerLogEntry) => {
    if (!entry.role) return lbl.timer;
    const bible = isBibleReading({ id: entry.sectionId, titleEn: entry.titleEn, titleEs: entry.titleEs });
    if (bible) return entry.role === "assignee" ? lbl.reader : lbl.conductor;
    return entry.role === "assignee" ? lbl.assignee : lbl.presiding;
  };
  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-surface/95 pb-safe-mobile">
      <button type="button" onClick={() => setShow((current) => !current)} aria-expanded={show}
        aria-controls="session-review-log"
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 active:bg-slate-50 dark:active:bg-slate-800/50 sticky bottom-0 z-10 bg-surface/95">
        <span>⏱ {lbl.sessionLog} {reviewEntries.length > 0 && `(${reviewEntries.length})`}</span>
        <span className="text-slate-400 text-lg leading-none">{show ? "▲" : "▼"}</span>
      </button>
      {show && (
         <div id="session-review-log" className="min-h-0 max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-5 pb-5 space-y-2">
          {reviewEntries.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">{lbl.logEmpty}</p>
          ) : (
             reviewEntries.map(({ entry, date }, i) => {
               const cf = (iso: string) => { const d = new Date(iso); return fmtClock(d.getHours() * 60 + d.getMinutes(), prefs.timeFormat === "24h"); };
               const editing = editingId === entry.id;
               return (
                 <div key={entry.id ?? `${date}-${entry.sectionId}-${i}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-canvas px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                   {editing && entry.id && onUpdateLog ? (
                     <LogEditor entry={entry} lbl={lbl} onCancel={() => setEditingId(null)} onSave={(patch) => { onUpdateLog(entry.id!, patch); setEditingId(null); }} />
                   ) : (
                     <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                       <span className="text-slate-400 text-[10px]">{i + 1}.</span>
                       <div className="min-w-0 break-words">{date && <span className="mr-2 text-[10px] text-slate-400">{date}</span>}<span>{isEs ? (entry.titleEs || entry.titleEn) : (entry.titleEn || entry.titleEs)}</span></div>
                       <div className="flex flex-wrap justify-end gap-1">
                         <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500">{roleName(entry)}</span>
                         {entry.id && onUpdateLog && <button type="button" onClick={() => setEditingId(entry.id!)} aria-label={`${lbl.editLog}: ${entry.titleEn}`} className="min-h-8 min-w-8 rounded-lg p-1 text-slate-400 hover:bg-primary/10 hover:text-primary"><span className="material-symbols-outlined text-base">edit</span></button>}
                         {onDeleteLog && entry.id && <button type="button" onClick={() => onDeleteLog(entry.id!)} aria-label={`${lbl.deleteLog}: ${entry.titleEn}`} className="min-h-8 min-w-8 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"><span className="material-symbols-outlined text-base">delete</span></button>}
                       </div>
                       <span className="col-span-2 font-mono text-[11px] text-slate-400">{cf(entry.actualStartISO)} - {cf(entry.actualEndISO)}</span>
                       <span className={cn("justify-self-end font-mono font-semibold", entry.wasOvertime ? "text-red-500" : "text-emerald-600")}>
                      {fmtTime(entry.actualDurationSec ?? Math.max(0, entry.actualDurationMin * 60))}{entry.wasOvertime ? ` (+${Math.max(0, (entry.actualDurationSec ?? entry.actualDurationMin * 60) - entry.scheduledDurationMin * 60) > 0 ? fmtTime(Math.max(0, (entry.actualDurationSec ?? entry.actualDurationMin * 60) - entry.scheduledDurationMin * 60)) : "0:00"})` : ""}
                       </span>
                     </div>
                   )}
                 </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
