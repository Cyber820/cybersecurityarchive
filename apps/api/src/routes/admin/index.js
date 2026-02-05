// apps/api/src/routes/admin/index.js
import { registerOrganizationAdmin } from './organization.js';
import { registerProductAdmin } from './product.js';
import { registerDomainAdmin } from './domain.js';
import { registerDropdownAdmin } from './dropdowns.js'

export async function adminRoutes(app) {
  registerOrganizationAdmin(app);
  registerProductAdmin(app);
  registerDomainAdmin(app);
registerDropdownAdmin(app);
}
