export const handler = async (numberObject: {
  number: number;
}): Promise<{ numberArray: number[] } | Error> => {
  return {
    numberArray: [...Array(numberObject.number).keys()].map((i) => ++i),
  };
};
