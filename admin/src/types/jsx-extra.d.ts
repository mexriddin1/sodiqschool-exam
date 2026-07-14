// Register the MathLive custom element with JSX so <math-field /> compiles
// without TypeScript complaining. Runtime registration happens on demand
// inside MathField.tsx via `import("mathlive")`.

declare namespace JSX {
  interface IntrinsicElements {
    "math-field": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        placeholder?: string;
        class?: string;
      },
      HTMLElement
    >;
  }
}
