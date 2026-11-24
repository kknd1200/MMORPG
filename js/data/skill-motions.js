// Dedicated shield sequence: reuse the approved artwork without the overhead sword windup.
export const SHIELD_BASH_MOTION = {
  source:'skill',
  frames:[0,1,1,4,4,5,5,4,1,6,7,0],
  durations:[80,70,80,90,70,70,90,90,80,80,90,110],
  hits:[4],
};
export const SHIELD_BASH_TIMING = { dashStart:.15, impact:.32, pullStart:.39, pullEnd:.72, duration:1 };

export function shieldBashPose(elapsed) {
  const t=SHIELD_BASH_TIMING;
  if (elapsed<t.dashStart) return {lean:.035,squash:.97,lunge:-2};
  if (elapsed<t.impact) return {lean:.10,squash:.96,lunge:4};
  if (elapsed<t.pullStart) return {lean:.055,squash:.95,lunge:2};
  if (elapsed<t.pullEnd) return {lean:-.035,squash:1.02,lunge:-1};
  return {lean:0,squash:1,lunge:0};
}
