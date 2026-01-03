# Failing E2E Tests

Total: 100 failing tests

## Auth Tests (3 tests)
- [ ] e2e/auth/login.spec.ts:233 - Login Page › MFA Flow › should accept valid MFA code
- [ ] e2e/auth/oauth-callback.spec.ts:133 - OAuth Callback Page › Provider-specific Callbacks › should handle Google OAuth success
- [ ] e2e/auth/reset-password.spec.ts:297 - Reset Password Page › Error Display › should display error page for invalid token access

## Billing Tests (16 tests)
- [ ] e2e/billing/checkout.spec.ts:174 - Checkout Flow › Checkout With Discount › should include discount code in checkout request when validated
- [ ] e2e/billing/checkout.spec.ts:260 - Checkout Flow › Loading State › should disable other upgrade buttons while loading
- [ ] e2e/billing/discount-code.spec.ts:130 - Discount Codes › Discount Validation › should validate discount code when clicking on a plan
- [ ] e2e/billing/discount-code.spec.ts:161 - Discount Codes › Discount Validation › should show discount applied message for valid code
- [ ] e2e/billing/discount-code.spec.ts:188 - Discount Codes › Discount Validation › should show original price with strikethrough
- [ ] e2e/billing/discount-code.spec.ts:216 - Discount Codes › Discount Validation › should show discounted price in green
- [ ] e2e/billing/discount-code.spec.ts:245 - Discount Codes › Discount Validation › should show percentage badge for percent discounts
- [ ] e2e/billing/discount-code.spec.ts:274 - Discount Codes › Invalid Discount Code › should show error toast for invalid code
- [ ] e2e/billing/discount-code.spec.ts:299 - Discount Codes › Invalid Discount Code › should show error for expired discount code
- [ ] e2e/billing/discount-code.spec.ts:323 - Discount Codes › Invalid Discount Code › should show error for code that does not apply to selected plan
- [ ] e2e/billing/discount-code.spec.ts:347 - Discount Codes › Loading State › should show loading state while validating
- [ ] e2e/billing/discount-code.spec.ts:376 - Discount Codes › Loading State › should disable input while validating
- [ ] e2e/billing/discount-code.spec.ts:406 - Discount Codes › Clear Discount After Validation › should clear discount when clicking X button
- [ ] e2e/billing/discount-code.spec.ts:443 - Discount Codes › Fixed Amount Discount › should show amount OFF for fixed discounts
- [ ] e2e/billing/pricing-plans.spec.ts:434 - Pricing Plans › Unauthenticated User › should show sign in message for unauthenticated users

## Accessibility Tests (6 tests)
- [ ] e2e/errors/accessibility.spec.ts:20 - Accessibility › Keyboard Navigation › should navigate login form with keyboard
- [ ] e2e/errors/accessibility.spec.ts:96 - Accessibility › Keyboard Navigation › should close dialog with Escape key
- [ ] e2e/errors/accessibility.spec.ts:124 - Accessibility › Focus Management › should trap focus in dialog
- [ ] e2e/errors/accessibility.spec.ts:156 - Accessibility › Focus Management › should restore focus after dialog closes
- [ ] e2e/errors/accessibility.spec.ts:312 - Accessibility › Form Labels › should have required indicator on required fields
- [ ] e2e/errors/accessibility.spec.ts:352 - Accessibility › Screen Reader › should have descriptive page titles

## API Error Handling Tests (7 tests)
- [ ] e2e/errors/api-errors.spec.ts:43 - API Error Handling › 400 Bad Request › should display field-specific errors
- [ ] e2e/errors/api-errors.spec.ts:113 - API Error Handling › 401 Unauthorized › should clear session on 401 during API call
- [ ] e2e/errors/api-errors.spec.ts:153 - API Error Handling › 403 Forbidden › should show access denied on forbidden API call
- [ ] e2e/errors/api-errors.spec.ts:212 - API Error Handling › 404 Not Found › should show not found for invalid team
- [ ] e2e/errors/api-errors.spec.ts:233 - API Error Handling › 404 Not Found › should handle 404 for invalid discount code
- [ ] e2e/errors/api-errors.spec.ts:307 - API Error Handling › 409 Conflict › should handle duplicate team invitation
- [ ] e2e/errors/api-errors.spec.ts:444 - API Error Handling › 500 Internal Server Error › should allow retry after server error

## Error Pages Tests (3 tests)
- [ ] e2e/errors/error-pages.spec.ts:172 - Error Pages › Authorization Errors › should show access denied message for restricted content
- [ ] e2e/errors/error-pages.spec.ts:205 - Error Pages › Form Submission Errors › should show field-level errors from API
- [ ] e2e/errors/error-pages.spec.ts:305 - Error Pages › Error Recovery › should clear errors when navigating away

## Loading States Tests (1 test)
- [ ] e2e/errors/loading-states.spec.ts:156 - Loading States › Button Loading States › should show loading spinner on save profile button

## Responsive Tests (2 tests)
- [ ] e2e/errors/responsive.spec.ts:203 - Responsive Design › Desktop View (1280x720) › should display pricing cards in row
- [ ] e2e/errors/responsive.spec.ts:340 - Responsive Design › Form Responsiveness › Mobile Form › should stack form buttons on mobile

## Toast Notifications Tests (6 tests)
- [ ] e2e/errors/toast-notifications.spec.ts:20 - Toast Notifications › Success Toasts › should show success toast on profile update
- [ ] e2e/errors/toast-notifications.spec.ts:200 - Toast Notifications › Toast Behavior › should auto-dismiss after timeout
- [ ] e2e/errors/toast-notifications.spec.ts:236 - Toast Notifications › Toast Behavior › should be dismissible by clicking close
- [ ] e2e/errors/toast-notifications.spec.ts:271 - Toast Notifications › Toast Behavior › should stack multiple toasts
- [ ] e2e/errors/toast-notifications.spec.ts:371 - Toast Notifications › Toast Content › should display success message from API
- [ ] e2e/errors/toast-notifications.spec.ts:451 - Toast Notifications › Toast Styling › should have different styling for success vs error

## Form Validation Tests (6 tests)
- [ ] e2e/forms/form-validation.spec.ts:103 - Form Validation › Required Fields › should show error for empty full name on register
- [ ] e2e/forms/form-validation.spec.ts:156 - Form Validation › Profile Form Validation › should show error for empty full name
- [ ] e2e/forms/form-validation.spec.ts:245 - Form Validation › MFA Code Validation › should show error for empty MFA code
- [ ] e2e/forms/form-validation.spec.ts:270 - Form Validation › MFA Code Validation › should show error for invalid MFA code format
- [ ] e2e/forms/form-validation.spec.ts:337 - Form Validation › Team Invite Validation › should show error for empty email
- [ ] e2e/forms/form-validation.spec.ts:345 - Form Validation › Team Invite Validation › should show error for invalid email

## Profile Edit Tests (7 tests)
- [ ] e2e/profile/profile-edit.spec.ts:71 - Profile Edit Page › Update Full Name › should update full name successfully
- [ ] e2e/profile/profile-edit.spec.ts:99 - Profile Edit Page › Update Avatar URL › should update avatar URL successfully
- [ ] e2e/profile/profile-edit.spec.ts:125 - Profile Edit Page › Update Avatar URL › should accept empty avatar URL
- [ ] e2e/profile/profile-edit.spec.ts:142 - Profile Edit Page › Avatar Display › should show avatar fallback with initials when no avatar URL
- [ ] e2e/profile/profile-edit.spec.ts:150 - Profile Edit Page › Avatar Display › should show avatar image when avatar URL is set
- [ ] e2e/profile/profile-edit.spec.ts:211 - Profile Edit Page › Loading States › should show loading state during submission
- [ ] e2e/profile/profile-edit.spec.ts:225 - Profile Edit Page › Loading States › should disable submit button during submission

## Security MFA Tests (14 tests)
- [ ] e2e/profile/security-mfa.spec.ts:72 - Security Page - MFA › MFA Setup Flow › should show QR code when clicking setup
- [ ] e2e/profile/security-mfa.spec.ts:82 - Security Page - MFA › MFA Setup Flow › should display backup codes
- [ ] e2e/profile/security-mfa.spec.ts:92 - Security Page - MFA › MFA Setup Flow › should have copy backup codes button
- [ ] e2e/profile/security-mfa.spec.ts:102 - Security Page - MFA › MFA Setup Flow › copy button should change text after copying
- [ ] e2e/profile/security-mfa.spec.ts:116 - Security Page - MFA › MFA Setup Flow › should show MFA code input field
- [ ] e2e/profile/security-mfa.spec.ts:126 - Security Page - MFA › MFA Setup Flow › should have Enable 2FA button
- [ ] e2e/profile/security-mfa.spec.ts:170 - Security Page - MFA › Enable MFA › should enable MFA with valid code
- [ ] e2e/profile/security-mfa.spec.ts:189 - Security Page - MFA › Enable MFA › should show error for invalid code
- [ ] e2e/profile/security-mfa.spec.ts:206 - Security Page - MFA › Enable MFA › should have cancel button during setup
- [ ] e2e/profile/security-mfa.spec.ts:240 - Security Page - MFA › MFA Enabled State › should show Disable 2FA button
- [ ] e2e/profile/security-mfa.spec.ts:249 - Security Page - MFA › MFA Enabled State › should show backup codes remaining
- [ ] e2e/profile/security-mfa.spec.ts:273 - Security Page - MFA › Disable MFA › should show code input when clicking disable
- [ ] e2e/profile/security-mfa.spec.ts:283 - Security Page - MFA › Disable MFA › should disable MFA with valid code
- [ ] e2e/profile/security-mfa.spec.ts:301 - Security Page - MFA › Disable MFA › should show error for invalid disable code

## Security Password Tests (4 tests)
- [ ] e2e/profile/security-password.spec.ts:50 - Security Page - Change Password › Successful Password Change › should change password with valid data
- [ ] e2e/profile/security-password.spec.ts:70 - Security Page - Change Password › Successful Password Change › should clear form after successful change
- [ ] e2e/profile/security-password.spec.ts:216 - Security Page - Change Password › Loading States › should show loading state during submission
- [ ] e2e/profile/security-password.spec.ts:235 - Security Page - Change Password › Loading States › should disable submit button during submission

## Settings Activity Tests (6 tests)
- [ ] e2e/profile/settings-activity.spec.ts:38 - Settings Page - Login Activity › Activity Table Display › should display login history table
- [ ] e2e/profile/settings-activity.spec.ts:70 - Settings Page - Login Activity › Activity Table Display › should show login method column
- [ ] e2e/profile/settings-activity.spec.ts:95 - Settings Page - Login Activity › Activity Table Display › should show IP address column
- [ ] e2e/profile/settings-activity.spec.ts:120 - Settings Page - Login Activity › Activity Table Display › should show date/time column
- [ ] e2e/profile/settings-activity.spec.ts:222 - Settings Page - Login Activity › Method Icons › should show MFA icon for MFA login
- [ ] e2e/profile/settings-activity.spec.ts:249 - Settings Page - Login Activity › Status Badges › should show green badge for successful login

## Settings Linked Accounts Tests (1 test)
- [ ] e2e/profile/settings-linked.spec.ts:344 - Settings Page - Linked Accounts › Unlink Account Action › should unlink Google account successfully

## Team Invite Members Tests (5 tests)
- [ ] e2e/team/invite-members.spec.ts:90 - Team Page - Invite Members › Admin/Owner Can Invite › should send invitation successfully
- [ ] e2e/team/invite-members.spec.ts:194 - Team Page - Invite Members › API Error Handling › should show error for duplicate invitation
- [ ] e2e/team/invite-members.spec.ts:206 - Team Page - Invite Members › API Error Handling › should show error for existing member
- [ ] e2e/team/invite-members.spec.ts:218 - Team Page - Invite Members › API Error Handling › should handle server error
- [ ] e2e/team/invite-members.spec.ts:249 - Team Page - Invite Members › Loading States › should disable button while sending invite

## Team Pending Invitations Tests (9 tests)
- [ ] e2e/team/pending-invitations.spec.ts:45 - Team Page - Pending Invitations › Invitations Table Display › should display pending invitations section
- [ ] e2e/team/pending-invitations.spec.ts:52 - Team Page - Pending Invitations › Invitations Table Display › should show invited email addresses
- [ ] e2e/team/pending-invitations.spec.ts:60 - Team Page - Pending Invitations › Invitations Table Display › should show role badge for each invitation
- [ ] e2e/team/pending-invitations.spec.ts:68 - Team Page - Pending Invitations › Invitations Table Display › should show expiration date
- [ ] e2e/team/pending-invitations.spec.ts:75 - Team Page - Pending Invitations › Invitations Table Display › should show delete button for each invitation
- [ ] e2e/team/pending-invitations.spec.ts:108 - Team Page - Pending Invitations › Delete Invitation › should show confirmation dialog when clicking delete
- [ ] e2e/team/pending-invitations.spec.ts:119 - Team Page - Pending Invitations › Delete Invitation › should cancel invitation after confirmation
- [ ] e2e/team/pending-invitations.spec.ts:137 - Team Page - Pending Invitations › Delete Invitation › should handle delete error
- [ ] e2e/team/pending-invitations.spec.ts:251 - Team Page - Pending Invitations › Confirmation Dialog › should close dialog on cancel
- [ ] e2e/team/pending-invitations.spec.ts:268 - Team Page - Pending Invitations › Confirmation Dialog › should show email in confirmation message

## Team Access Tests (1 test)
- [ ] e2e/team/team-access.spec.ts:224 - Team Page Access Control › Error Handling › should handle team not found

## Team Members Tests (2 tests)
- [ ] e2e/team/team-members.spec.ts:185 - Team Page - Team Members › Owner Actions › should not show delete button for owner (self)
- [ ] e2e/team/team-members.spec.ts:312 - Team Page - Team Members › Role Change › should change member role successfully
