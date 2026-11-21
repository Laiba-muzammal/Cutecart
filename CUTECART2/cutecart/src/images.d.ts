// images.d.ts
declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}
// Option A: Treat SVG as a string URL (like JPG/PNG)
declare module '*.svg' {
  const content: string;
  export default content;
}
// Add declarations for other file types like .webp, .gif, etc., if needed.