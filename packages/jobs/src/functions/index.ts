export { dailyAgentCron, dailyAgentOnDemand } from "./daily-agent.js";
export { whatsappSend } from "./whatsapp-send.js";
export { quietCustomerCheck } from "./quiet-customer.js";
export { accessRequestNotify } from "./access-request.js";

import { dailyAgentCron, dailyAgentOnDemand } from "./daily-agent.js";
import { whatsappSend } from "./whatsapp-send.js";
import { quietCustomerCheck } from "./quiet-customer.js";
import { accessRequestNotify } from "./access-request.js";

export const allFunctions = [
  dailyAgentCron,
  dailyAgentOnDemand,
  whatsappSend,
  quietCustomerCheck,
  accessRequestNotify,
];
