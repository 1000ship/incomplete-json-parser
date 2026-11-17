import { IncompleteJsonParser, type JsonValue, type JsonObject, type JsonArray, type JsonPrimitive, type JsonParseError } from 'incomplete-json-parser';

const parser = new IncompleteJsonParser();
parser.write('{"items":[1]}');
const complete: boolean = parser.isComplete();
const preview: JsonObject = parser.getObjects<JsonObject>();
const finished: JsonValue = parser.finish<JsonValue>();
const parsed: JsonArray = IncompleteJsonParser.parse<JsonArray>('[1,true]');
const primitive: JsonPrimitive = null;
const errorOffset = (error: JsonParseError): number => error.offset;
void [complete, preview, finished, parsed, primitive, errorOffset];
// @ts-expect-error write accepts text, not numbers
parser.write(123);
// @ts-expect-error JsonValue cannot contain functions
const invalidJson: JsonValue = () => 1;
void invalidJson;
