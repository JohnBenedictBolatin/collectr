type Pose = "welcome" | "point" | "celebrate" | "rest";

export function Cole({ pose = "welcome", className = "" }: { pose?: Pose; className?: string }) {
  const positions: Record<Pose, string> = {
    welcome: "0% 0%", point: "100% 0%", celebrate: "0% 100%", rest: "100% 100%",
  };
  return <span aria-hidden="true" className={`cole ${className}`} style={{ backgroundPosition: positions[pose] }} />;
}
