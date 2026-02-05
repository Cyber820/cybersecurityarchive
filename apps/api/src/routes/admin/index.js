// apps/api/src/routes/admin/index.js
import { registerOrganizationAdmin } from './organization.js';
import { registerProductAdmin } from './product.js';
import { registerDomainAdmin } from './domain.js';
import { registerOrganizationProductAdmin } from './organizationProduct.js';
import { registerProductDomainAdmin } from './productDomain.js';

export async function adminRoutes(app) {
  registerOrganizationAdmin(app);
  registerProductAdmin(app);
  registerDomainAdmin(app);
  registerOrganizationProductAdmin(app);
  registerProductDomainAdmin(app);
}
