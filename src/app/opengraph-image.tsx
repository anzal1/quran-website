import { ImageResponse } from "next/og";

export const alt = "Quran Lens interface preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F7F2E8",
          color: "#13201F",
          fontFamily: "Inter, Arial, sans-serif",
          padding: 56,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            border: "2px solid #1B3C37",
            background: "#FCFAF4",
          }}
        >
          <div
            style={{
              width: 360,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 34,
              background: "#123C36",
              color: "#F8F3E7",
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  background: "#F1C86B",
                  color: "#123C36",
                  fontSize: 38,
                  fontWeight: 800,
                }}
              >
                Q
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 31, fontWeight: 800 }}>Quran Lens</div>
                <div style={{ fontSize: 17, color: "#D7E7DE" }}>
                  Ask. Read. Check.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 22, color: "#F1C86B" }}>
                Evidence-first Quran search
              </div>
              <div style={{ fontSize: 18, lineHeight: 1.35, color: "#D7E7DE" }}>
                Natural questions, cited verses, semantic discovery, and
                grounded AI summaries.
              </div>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 48,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  fontSize: 74,
                  lineHeight: 0.96,
                  fontWeight: 850,
                  letterSpacing: 0,
                  maxWidth: 640,
                }}
              >
                Understand the Quran through cited answers.
              </div>
              <div style={{ fontSize: 27, lineHeight: 1.3, color: "#465651" }}>
                Built for people who want clarity without losing the source.
              </div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {["Patience", "Remembrance", "Forgiveness"].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    padding: "18px 22px",
                    border: "1px solid #D7C8A6",
                    background: "#F8F3E7",
                    fontSize: 23,
                    fontWeight: 700,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
