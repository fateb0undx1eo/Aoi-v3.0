declare module 'chroma-js' {
  interface Color {
    [key: string]: any;
  }
  interface ChromaStatic {
    (color: string | number): Color;
    deltaE(color1: Color, color2: Color): number;
  }
  const chroma: ChromaStatic;
  export default chroma;
}
