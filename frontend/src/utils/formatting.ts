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

export const LOADING_MESSAGES = [
  // Ocean themed
  "Diving into the collection...",
  "Swimming through the blockchain...",
  "Fishing for NFTs...",
  "Exploring the digital depths...",
  "Surfing the metadata waves...",
  "Catching rare digital fish...",
  "Navigating the NFT ocean...",
  "Consulting the sea creatures...",
  "Summoning the Kraken...",
  "Waiting for committer to communicate",
  "Whales eat tacos for breakfast",
  "You're ghey...",
  "So who is ghey?",
  "I'm a toaster",
  "Coal will rise again",
  "Justice for coal",
  "Building the pepecoin world order",
  "The pepecoin world order is being built",
  "Whoooooooooooooooo la la (loading)",
  "Kekity kek",
  "Kekity kekity kekity kekity kekity kekity kekity kek",

  // Self-deprecating/dark humor
  "Committing toaster bath",
  "Our intern doesn't get paid enough for this shit",
  "Alt+F4 for instant results...",
  "Go touch some grass",
];
