import { processSchema } from "../variables/schema";
import { processVariables } from "../template-compiler";

export async function processForLoop(
  match: RegExpExecArray,
  variables: Record<string, unknown>,
  currentUrl: string,
  processLogic: (
    text: string,
    variables: Record<string, unknown>,
    currentUrl: string,
  ) => Promise<string>,
): Promise<string> {
  console.log("Processing loop:", match[0]);

  const [fullMatch, iteratorName, arrayName, loopContent] = match;

  let arrayValue: unknown;
  if (arrayName.startsWith("schema:")) {
    const schemaResult = await processSchema(
      `{{${arrayName}}}`,
      variables as Record<string, string>,
      currentUrl,
    );
    try {
      arrayValue = JSON.parse(schemaResult);
    } catch (error) {
      console.error(`Error parsing schema result for ${arrayName}:`, error);
      return "";
    }
  } else if (arrayName.includes(".")) {
    arrayValue = arrayName.split(".").reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === "object" && obj !== null && key in obj) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (obj as Record<string, unknown>)[key];
      }
      console.error(`Cannot access property ${key} of`, obj);
      return undefined;
    }, variables);
  } else {
    arrayValue = variables[arrayName];
  }

  console.log(`Array value for ${arrayName}:`, arrayValue);

  if (!Array.isArray(arrayValue)) {
    console.error(`Invalid array value for ${arrayName}:`, arrayValue);
    return ""; // Remove the loop if array is invalid
  }

  const processedContent = await Promise.all(
    (arrayValue as unknown[]).map(async (item: unknown, index: number) => {
      console.log(`Processing item ${index} of ${arrayName}:`, item);
      const localVariables: Record<string, unknown> = {
        ...variables,
        [iteratorName]: item,
      };
      // Process nested loops and other logic structures recursively
      let itemContent = await processLogic(
        loopContent,
        localVariables,
        currentUrl,
      );
      // Process variables after nested loops, using both global and local variables
      itemContent = await processVariables(
        0,
        itemContent,
        localVariables,
        currentUrl,
      );
      return itemContent.trim();
    }),
  );

  return processedContent.join("\n");
}
