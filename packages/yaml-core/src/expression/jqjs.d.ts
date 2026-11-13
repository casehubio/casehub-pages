declare module '@sscots/jqjs' {
  const jq: {
    compile(expression: string): (input: unknown) => IterableIterator<unknown, unknown>;
  };
  export default jq;
}
