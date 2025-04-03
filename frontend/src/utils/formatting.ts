// Format numbers with commas for better readability
export const formatNumberWithCommas = (value: number | string) => {
  // Handle null, undefined or empty string
  if (!value && value !== 0) return "0";

  // Convert to string if it's not already
  const stringValue = String(value);

  // Split by decimal point if present
  const parts = stringValue.split(".");

  // Add commas to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Limit decimal places to 2 digits if decimal exists
  if (parts[1]) {
    parts[1] = parts[1].substring(0, 2);
  }

  // Join back with decimal part if it exists
  return parts.join(".");
};
