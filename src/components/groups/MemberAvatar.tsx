"use client";

interface MemberAvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
}

const AVATAR_COLORS = [
  ["#C4552A", "#E8734A"],
  ["#6B7A52", "#8FA367"],
  ["#4A6B9A", "#6B8FBF"],
  ["#9A4A6B", "#BF6B8F"],
  ["#6B4A9A", "#8F6BBF"],
  ["#4A9A6B", "#6BBF8F"],
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function MemberAvatar({ name, size = 36, imageUrl }: MemberAvatarProps) {
  const [c1, c2] = getColor(name);
  const initial = name.charAt(0);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "2px solid var(--surface)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
        border: "2px solid var(--surface)",
      }}
    >
      {initial}
    </div>
  );
}

interface MemberAvatarStackProps {
  members: string[];
  maxShow?: number;
  size?: number;
}

export function MemberAvatarStack({ members, maxShow = 4, size = 32 }: MemberAvatarStackProps) {
  const shown = members.slice(0, maxShow);
  const extra = members.length - maxShow;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((name, i) => (
        <div
          key={i}
          style={{
            marginLeft: i > 0 ? -size * 0.3 : 0,
            zIndex: shown.length - i,
            position: "relative",
          }}
        >
          <MemberAvatar name={name} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: "var(--bg-secondary)",
            border: "2px solid var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.35,
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginLeft: -size * 0.3,
            zIndex: 0,
            position: "relative",
            flexShrink: 0,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
