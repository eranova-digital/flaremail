import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {Record<string, string>} */
const en = {
	"bad-request": "Bad request",
	unauthorized: "Unauthorized",
	forbidden: "Forbidden",
	"not-found": "The requested resource was not found",
	"content-too-large": "Request body is too large",
	"rate-limit-exceeded": "Rate limit exceeded. Please try again later.",
	"validation-error": "Validation failed",
	"invalid-json": "Request body must be valid JSON",
	"missing-query-parameter": "A required query parameter is missing",
	"internal-error": "Internal server error",
	"no-recovery-email":
		"You haven't configured a recovery email. Please ask a supervisor for a recovery code.",
	"authentication-required": "Authentication required",
	"invalid-credentials": "Invalid credentials",
	"invalid-token": "Invalid token",
	"session-expired": "Session expired",
	"session-invalid": "Session invalid",
	"invalid-api-key": "Invalid API key",
	"api-keys-cannot-access": "API keys cannot access this endpoint",
	"api-key-scope-required": "This API key is missing a required scope",
	"session-required": "This endpoint requires an authenticated session",
	"account-suspended": "Account is suspended",
	"account-not-activated": "Account is not activated",
	"account-not-found": "Account not found",
	"invalid-or-expired-invite-code": "Invalid or expired invite code",
	"invite-no-longer-valid": "Invite is no longer valid",
	"invalid-or-expired-reset-code": "Invalid or expired reset code",
	"invalid-or-expired-verification-code": "Invalid or expired verification code",
	"method-not-allowed": "Method not allowed",
	"thread-has-no-messages-to-reply-to": "Thread has no messages to reply to",
	"webauthn-origin-not-allowed": "WebAuthn origin is not allowed",
	"invalid-mfa-challenge": "Invalid MFA challenge",
	"invalid-passkey-challenge": "Invalid passkey challenge",
	"challenge-already-used": "Challenge already used",
	"invalid-authentication-code": "Invalid authentication code",
	"authenticator-code-required": "Authenticator code is required",
	"mfa-not-enabled": "Two-factor authentication is not enabled",
	"mfa-not-enabled-for-account":
		"Two-factor authentication is not enabled for this account",
	"mfa-already-enabled": "Two-factor authentication is already enabled",
	"start-mfa-setup-before-confirming":
		"Start two-factor setup before confirming",
	"only-intendant-can-regenerate-password":
		"Only the recovery account can regenerate this password",
	"cannot-modify-own-assignments": "Cannot modify your own assignments",
	"only-admins-can-change-manager-scope":
		"Only admins can change manager domain or shared-mailbox scope",
	"catch-all-mailbox-invalid":
		"Catch-all mailbox must be an active receiving mailbox on this domain",
	"domain-already-exists": "Domain already exists",
	"domain-not-found": "Domain not found",
	"attachment-not-found": "Attachment not found",
	"attachment-content-not-found": "Attachment content not found",
	"image-not-found": "Image not found",
	"message-not-found": "Message not found",
	"invalid-email-address": "Invalid email address",
	"mailbox-address-required": "Mailbox address is required",
	"passkey-id-required": "Passkey id is required",
	"password-required": "Password is required",
	"email-and-password-required": "Email and password are required",
	"code-and-password-required": "Code and password are required",
	"code-required": "Code is required",
	"address-required": "Address is required",
	"mfa-token-and-code-required": "MFA token and code are required",
	"challenge-token-and-response-required":
		"Challenge token and response are required",
	"code-query-parameter-required": "Code query parameter is required",
	"unsupported-grant-type": "Unsupported grant type",
	"cannot-suspend-intendant": "Cannot suspend the recovery account",
	"intendant-cannot-be-managed": "The recovery account cannot be managed",
	"cannot-update-intendant-assignments":
		"Cannot update recovery account assignments",
	"assignments-admin-or-manager-only":
		"Assignments only apply to admin or manager accounts",
	"forbidden-domain-assignment": "Forbidden domain assignment",
	"forbidden-shared-mailbox-assignment": "Forbidden shared mailbox assignment",
	"invalid-shared-mailbox-assignment": "Invalid shared mailbox assignment",
	"mailbox-grants-not-for-intendant":
		"Mailbox grants cannot apply to the recovery account",
	"invalid-content-length": "Invalid Content-Length",
	"request-body-too-large": "Request body is too large",
	"request-body-must-be-valid-json": "Request body must be valid JSON",
	"mailbox-not-found": "Mailbox not found",
	"mailbox-already-exists": "Mailbox already exists",
	"mailbox-not-active": "Mailbox is not active",
	"mailbox-cannot-send": "Mailbox not found or cannot send",
	"identity-not-found": "Identity not found",
	"label-not-found": "Label not found",
	"label-already-exists": "Label already exists for this mailbox",
	"thread-not-found": "Thread not found",
	"draft-not-found": "Draft not found",
	"template-not-found": "Template not found",
	"oidc-client-not-found": "OIDC client not found",
	"consent-grant-not-found": "Consent grant not found",
	"pending-authorization-not-found": "Pending authorization not found",
	"passkey-not-found": "Passkey not found",
	"passkey-not-recognized": "Passkey not recognized",
	"no-passkeys-registered": "No passkeys are registered for this account",
	"passkey-does-not-belong": "Passkey does not belong to this account",
	"passkey-registration-failed": "Passkey registration could not be verified",
	"passkey-sign-in-failed": "Passkey sign-in could not be verified",
	"invalid-passkey-response": "Invalid passkey response",
	"invalid-password": "Invalid password",
	"invalid-recovery-email": "Invalid recovery email address",
	"recovery-email-in-use":
		"This recovery email is already in use by another account",
	"no-recovery-email-configured": "No recovery email configured",
	"eligible-account-required": "Eligible account required",
	"expected-multipart-form-data": "Expected multipart form data",
	"invalid-form-data": "Invalid form data",
	"file-required": "File is required",
	"name-required": "Name is required",
	"name-and-redirect-uris-required": "Name and redirect URIs are required",
	"no-valid-fields-provided": "No valid fields were provided",
	"no-valid-settings-provided": "No valid settings were provided",
	"invalid-folder-query-parameter": "Invalid folder query parameter",
	"field-required": "A required field is missing",
	"field-invalid": "A field has an invalid value",
	"email-required": "Email is required",
	"email-and-code-required": "Email and code are required",
	"password-and-code-required": "Password and code are required",
	"domain-id-required": "Domain is required",
	"domain-id-and-local-part-required": "Domain and local part are required",
	"account-id-and-role-required": "Account and role are required",
	"mailbox-id-required": "Mailbox is required",
	"identity-id-required": "Identity id is required",
	"name-pattern-required": "Name pattern is required",
	"pending-id-and-decision-required":
		"Pending authorization and decision are required",
	"from-must-be-iso-datetime": "From must be a valid ISO datetime",
	"to-must-be-iso-datetime": "To must be a valid ISO datetime",
	"only-intendant-can-regenerate": "Only the recovery account can regenerate",
	"unknown-thread-action": "Unknown thread action",
	"search-query-required": "Search query is required",
	"invalid-domain-name": "Invalid domain name",
	"invalid-mailbox-address": "Invalid mailbox address",
	"invalid-mailbox-local-part": "Invalid mailbox local part",
	"address-domain-mismatch":
		"Address domain does not match the selected domain",
	"address-reserved-for-system": "Address is reserved for system mailboxes",
	"system-mailboxes-auto-provisioned":
		"System mailboxes are provisioned automatically",
	"system-mailboxes-immutable":
		"System mailboxes cannot be modified or deleted",
	"alias-mailboxes-cannot-send": "Alias mailboxes cannot send mail",
	"alias-target-must-be-receiving":
		"Alias target must reference a receiving mailbox",
	"only-shared-mailboxes-support-grants":
		"Only shared mailboxes support grants",
	"only-shared-mailboxes-support-manager-assignments":
		"Only shared mailboxes support manager assignments",
	"manager-assignments-manager-only":
		"Manager assignments only apply to manager accounts",
	"shared-mailbox-access-not-for-intendant":
		"Shared mailbox access cannot be granted to the recovery account",
	"invite-codes-pending-only":
		"Invite codes can only be regenerated for pending accounts",
	"intendant-profile-cannot-be-edited":
		"Recovery account profile cannot be edited",
	"could-not-determine-sender-domain":
		"Could not determine sender domain for this account",
	"default-identity-custom-name-required":
		"Custom name is required for the custom name pattern",
	"local-part-policy-could-not-be-applied":
		"Local part policy could not be applied from profile fields",
	"at-least-one-api-key-scope-required":
		"At least one API key scope is required",
	"text-or-html-required": "At least one of text or HTML is required",
	"to-must-be-non-empty-array": "To must be a non-empty list of recipients",
	"subject-required": "Subject is required",
	"attachments-must-be-array": "Attachments must be an array",
	"label-ids-must-be-array": "Label ids must be an array",
	"query-required": "Query is required",
	"type-invalid": "Type is invalid",
	"homescreen-url-invalid": "Homescreen URL must be a valid URL",
	"homescreen-url-scheme-invalid": "Homescreen URL must be http or https",
	"redirect-uris-not-empty": "Redirect URIs must not be empty",
	"public-clients-have-no-secrets": "Public clients do not have secrets",
	"importance-out-of-range": "Importance must be an integer from 0 to 10",
	"image-too-large": "Image is too large",
	"unsupported-image-type": "Unsupported image type",
	"size-must-be-small-or-large": "Size must be small or large",
	"template-file-too-large": "Template file must be 1 MiB or smaller",
	"html-file-empty": "That HTML file is empty",
	"unknown-system-email-template": "Unknown system email template",
	"system-template-not-configured": "System template not configured",
	"system-template-content-not-found": "System template content not found",
	"template-content-not-found": "Template content not found",
	"oidc-client-logo-not-found": "OIDC client logo not found",
	"profile-picture-not-found": "Profile picture not found",
	"session-not-found": "Session not found",
	"raw-message-not-found": "Raw message not found",
	"parent-message-not-found": "Parent message not found",
	"validation-run-not-found": "Validation run not found",
	"one-or-more-labels-not-found": "One or more labels not found",
	"message-id-header-required": "Message-ID header is required",
	"parent-message-id-required-for-reply":
		"Parent message-id is required for reply threading",
	"message-id-conflict-draft": "Message-ID conflict while storing draft",
	"message-id-conflict-outbound":
		"Message-ID conflict while storing outbound message",
	"request-body-must-be-object": "Request body must be an object",
	"invite-role-required": "Invite role is required for this operation",
	"remove-target-required": "Remove target is required for this operation",
	"invalid-alias-target-address": "Invalid alias target address",
	"something-went-wrong": "Something went wrong",
};

/** @type {Record<string, string>} */
const ro = {
	"bad-request": "Cerere invalidă",
	unauthorized: "Neautorizat",
	forbidden: "Interzis",
	"not-found": "Resursa solicitată nu a fost găsită",
	"content-too-large": "Corpul cererii este prea mare",
	"rate-limit-exceeded":
		"Limita de cereri a fost depășită. Încercați din nou mai târziu.",
	"validation-error": "Validare eșuată",
	"invalid-json": "Corpul cererii trebuie să fie JSON valid",
	"missing-query-parameter": "Lipsește un parametru de interogare obligatoriu",
	"internal-error": "Eroare internă de server",
	"no-recovery-email":
		"Nu ați configurat un e-mail de recuperare. Cereți un cod de recuperare unui supervizor.",
	"authentication-required": "Autentificare necesară",
	"invalid-credentials": "Date de autentificare invalide",
	"invalid-token": "Token invalid",
	"session-expired": "Sesiunea a expirat",
	"session-invalid": "Sesiune invalidă",
	"invalid-api-key": "Cheie API invalidă",
	"api-keys-cannot-access": "Cheile API nu pot accesa acest endpoint",
	"api-key-scope-required":
		"Această cheie API nu are un domeniu de acces necesar",
	"session-required": "Acest endpoint necesită o sesiune autentificată",
	"account-suspended": "Contul este suspendat",
	"account-not-activated": "Contul nu este activat",
	"account-not-found": "Contul nu a fost găsit",
	"invalid-or-expired-invite-code": "Cod de invitație invalid sau expirat",
	"invite-no-longer-valid": "Invitația nu mai este valabilă",
	"invalid-or-expired-reset-code": "Cod de resetare invalid sau expirat",
	"invalid-or-expired-verification-code":
		"Cod de verificare invalid sau expirat",
	"method-not-allowed": "Metodă nepermisă",
	"thread-has-no-messages-to-reply-to":
		"Firul nu are mesaje la care să răspundeți",
	"webauthn-origin-not-allowed": "Originea WebAuthn nu este permisă",
	"invalid-mfa-challenge": "Provocare MFA invalidă",
	"invalid-passkey-challenge": "Provocare passkey invalidă",
	"challenge-already-used": "Provocarea a fost deja folosită",
	"invalid-authentication-code": "Cod de autentificare invalid",
	"authenticator-code-required": "Codul autentificatorului este obligatoriu",
	"mfa-not-enabled": "Autentificarea în doi pași nu este activată",
	"mfa-not-enabled-for-account":
		"Autentificarea în doi pași nu este activată pentru acest cont",
	"mfa-already-enabled": "Autentificarea în doi pași este deja activată",
	"start-mfa-setup-before-confirming":
		"Începeți configurarea autentificării în doi pași înainte de confirmare",
	"only-intendant-can-regenerate-password":
		"Doar contul de recuperare poate regenera această parolă",
	"cannot-modify-own-assignments": "Nu vă puteți modifica propriile atribuiri",
	"only-admins-can-change-manager-scope":
		"Doar administratorii pot schimba domeniul sau domeniul cutiei partajate al managerului",
	"catch-all-mailbox-invalid":
		"Cutia catch-all trebuie să fie o cutie activă de primire pe acest domeniu",
	"domain-already-exists": "Domeniul există deja",
	"domain-not-found": "Domeniul nu a fost găsit",
	"attachment-not-found": "Atașamentul nu a fost găsit",
	"attachment-content-not-found": "Conținutul atașamentului nu a fost găsit",
	"image-not-found": "Imaginea nu a fost găsită",
	"message-not-found": "Mesajul nu a fost găsit",
	"invalid-email-address": "Adresă de e-mail invalidă",
	"mailbox-address-required": "Adresa cutiei poștale este obligatorie",
	"passkey-id-required": "ID-ul passkey este obligatoriu",
	"password-required": "Parola este obligatorie",
	"email-and-password-required": "E-mailul și parola sunt obligatorii",
	"code-and-password-required": "Codul și parola sunt obligatorii",
	"code-required": "Codul este obligatoriu",
	"address-required": "Adresa este obligatorie",
	"mfa-token-and-code-required": "Tokenul MFA și codul sunt obligatorii",
	"challenge-token-and-response-required":
		"Tokenul provocării și răspunsul sunt obligatorii",
	"code-query-parameter-required":
		"Parametrul de interogare code este obligatoriu",
	"unsupported-grant-type": "Tip de grant neacceptat",
	"cannot-suspend-intendant": "Contul de recuperare nu poate fi suspendat",
	"intendant-cannot-be-managed": "Contul de recuperare nu poate fi gestionat",
	"cannot-update-intendant-assignments":
		"Nu se pot actualiza atribuirile contului de recuperare",
	"assignments-admin-or-manager-only":
		"Atribuirile se aplică doar conturilor de admin sau manager",
	"forbidden-domain-assignment": "Atribuire de domeniu interzisă",
	"forbidden-shared-mailbox-assignment":
		"Atribuire de cutie partajată interzisă",
	"invalid-shared-mailbox-assignment": "Atribuire de cutie partajată invalidă",
	"mailbox-grants-not-for-intendant":
		"Drepturile pe cutii nu se aplică contului de recuperare",
	"invalid-content-length": "Content-Length invalid",
	"request-body-too-large": "Corpul cererii este prea mare",
	"request-body-must-be-valid-json": "Corpul cererii trebuie să fie JSON valid",
	"mailbox-not-found": "Cutia poștală nu a fost găsită",
	"mailbox-already-exists": "Cutia poștală există deja",
	"mailbox-not-active": "Cutia poștală nu este activă",
	"mailbox-cannot-send": "Cutia poștală nu a fost găsită sau nu poate trimite",
	"identity-not-found": "Identitatea nu a fost găsită",
	"label-not-found": "Eticheta nu a fost găsită",
	"label-already-exists": "Eticheta există deja pentru această cutie",
	"thread-not-found": "Firul nu a fost găsit",
	"draft-not-found": "Ciorna nu a fost găsită",
	"template-not-found": "Șablonul nu a fost găsit",
	"oidc-client-not-found": "Clientul OIDC nu a fost găsit",
	"consent-grant-not-found": "Acordul de consimțământ nu a fost găsit",
	"pending-authorization-not-found":
		"Autorizarea în așteptare nu a fost găsită",
	"passkey-not-found": "Passkey-ul nu a fost găsit",
	"passkey-not-recognized": "Passkey nerecunoscut",
	"no-passkeys-registered":
		"Nu există passkey-uri înregistrate pentru acest cont",
	"passkey-does-not-belong": "Passkey-ul nu aparține acestui cont",
	"passkey-registration-failed":
		"Înregistrarea passkey nu a putut fi verificată",
	"passkey-sign-in-failed":
		"Autentificarea cu passkey nu a putut fi verificată",
	"invalid-passkey-response": "Răspuns passkey invalid",
	"invalid-password": "Parolă invalidă",
	"invalid-recovery-email": "Adresă de e-mail de recuperare invalidă",
	"recovery-email-in-use":
		"Acest e-mail de recuperare este deja folosit de alt cont",
	"no-recovery-email-configured": "Nu este configurat un e-mail de recuperare",
	"eligible-account-required": "Este necesar un cont eligibil",
	"expected-multipart-form-data": "Se așteaptă date multipart/form-data",
	"invalid-form-data": "Date de formular invalide",
	"file-required": "Fișierul este obligatoriu",
	"name-required": "Numele este obligatoriu",
	"name-and-redirect-uris-required":
		"Numele și URI-urile de redirecționare sunt obligatorii",
	"no-valid-fields-provided": "Nu au fost furnizate câmpuri valide",
	"no-valid-settings-provided": "Nu au fost furnizate setări valide",
	"invalid-folder-query-parameter": "Parametru de folder invalid",
	"field-required": "Lipsește un câmp obligatoriu",
	"field-invalid": "Un câmp are o valoare invalidă",
	"email-required": "E-mailul este obligatoriu",
	"email-and-code-required": "E-mailul și codul sunt obligatorii",
	"password-and-code-required": "Parola și codul sunt obligatorii",
	"domain-id-required": "Domeniul este obligatoriu",
	"domain-id-and-local-part-required":
		"Domeniul și partea locală sunt obligatorii",
	"account-id-and-role-required": "Contul și rolul sunt obligatorii",
	"mailbox-id-required": "Cutia poștală este obligatorie",
	"identity-id-required": "ID-ul identității este obligatoriu",
	"name-pattern-required": "Modelul de nume este obligatoriu",
	"pending-id-and-decision-required":
		"Autorizarea în așteptare și decizia sunt obligatorii",
	"from-must-be-iso-datetime": "From trebuie să fie o dată/oră ISO validă",
	"to-must-be-iso-datetime": "To trebuie să fie o dată/oră ISO validă",
	"only-intendant-can-regenerate": "Doar contul de recuperare poate regenera",
	"unknown-thread-action": "Acțiune necunoscută pe fir",
	"search-query-required": "Interogarea de căutare este obligatorie",
	"invalid-domain-name": "Nume de domeniu invalid",
	"invalid-mailbox-address": "Adresă de cutie poștală invalidă",
	"invalid-mailbox-local-part": "Parte locală de cutie poștală invalidă",
	"address-domain-mismatch":
		"Domeniul adresei nu corespunde domeniului selectat",
	"address-reserved-for-system": "Adresa este rezervată cutiilor de sistem",
	"system-mailboxes-auto-provisioned": "Cutiile de sistem sunt create automat",
	"system-mailboxes-immutable":
		"Cutiile de sistem nu pot fi modificate sau șterse",
	"alias-mailboxes-cannot-send": "Cutiile alias nu pot trimite e-mailuri",
	"alias-target-must-be-receiving":
		"Ținta alias trebuie să fie o cutie de primire",
	"only-shared-mailboxes-support-grants":
		"Doar cutiile partajate acceptă drepturi",
	"only-shared-mailboxes-support-manager-assignments":
		"Doar cutiile partajate acceptă atribuiri de manager",
	"manager-assignments-manager-only":
		"Atribuirile de manager se aplică doar conturilor de manager",
	"shared-mailbox-access-not-for-intendant":
		"Accesul la cutia partajată nu poate fi acordat contului de recuperare",
	"invite-codes-pending-only":
		"Codurile de invitație pot fi regenerate doar pentru conturi în așteptare",
	"intendant-profile-cannot-be-edited":
		"Profilul contului de recuperare nu poate fi editat",
	"could-not-determine-sender-domain":
		"Nu s-a putut determina domeniul expeditorului pentru acest cont",
	"default-identity-custom-name-required":
		"Numele personalizat este obligatoriu pentru modelul personalizat",
	"local-part-policy-could-not-be-applied":
		"Politica părții locale nu a putut fi aplicată din câmpurile de profil",
	"at-least-one-api-key-scope-required":
		"Este necesar cel puțin un domeniu de acces pentru cheia API",
	"text-or-html-required": "Este necesar cel puțin text sau HTML",
	"to-must-be-non-empty-array":
		"Destinatarii (To) trebuie să fie o listă nevidă",
	"subject-required": "Subiectul este obligatoriu",
	"attachments-must-be-array": "Atașamentele trebuie să fie un tablou",
	"label-ids-must-be-array": "ID-urile etichetelor trebuie să fie un tablou",
	"query-required": "Interogarea este obligatorie",
	"type-invalid": "Tipul este invalid",
	"homescreen-url-invalid": "URL-ul ecranului de start trebuie să fie valid",
	"homescreen-url-scheme-invalid":
		"URL-ul ecranului de start trebuie să fie http sau https",
	"redirect-uris-not-empty":
		"URI-urile de redirecționare nu trebuie să fie goale",
	"public-clients-have-no-secrets": "Clienții publici nu au secrete",
	"importance-out-of-range": "Importanța trebuie să fie un întreg între 0 și 10",
	"image-too-large": "Imaginea este prea mare",
	"unsupported-image-type": "Tip de imagine neacceptat",
	"size-must-be-small-or-large": "Dimensiunea trebuie să fie small sau large",
	"template-file-too-large": "Fișierul șablon trebuie să aibă cel mult 1 MiB",
	"html-file-empty": "Fișierul HTML este gol",
	"unknown-system-email-template": "Șablon de e-mail de sistem necunoscut",
	"system-template-not-configured": "Șablonul de sistem nu este configurat",
	"system-template-content-not-found":
		"Conținutul șablonului de sistem nu a fost găsit",
	"template-content-not-found": "Conținutul șablonului nu a fost găsit",
	"oidc-client-logo-not-found": "Logo-ul clientului OIDC nu a fost găsit",
	"profile-picture-not-found": "Poza de profil nu a fost găsită",
	"session-not-found": "Sesiunea nu a fost găsită",
	"raw-message-not-found": "Mesajul brut nu a fost găsit",
	"parent-message-not-found": "Mesajul părinte nu a fost găsit",
	"validation-run-not-found": "Rularea de validare nu a fost găsită",
	"one-or-more-labels-not-found": "Una sau mai multe etichete nu au fost găsite",
	"message-id-header-required": "Antetul Message-ID este obligatoriu",
	"parent-message-id-required-for-reply":
		"Message-ID-ul părinte este obligatoriu pentru răspunsuri",
	"message-id-conflict-draft": "Conflict Message-ID la stocarea ciornei",
	"message-id-conflict-outbound":
		"Conflict Message-ID la stocarea mesajului trimis",
	"request-body-must-be-object": "Corpul cererii trebuie să fie un obiect",
	"invite-role-required":
		"Rolul de invitație este obligatoriu pentru această operațiune",
	"remove-target-required":
		"Ținta de eliminare este obligatorie pentru această operațiune",
	"invalid-alias-target-address": "Adresă țintă alias invalidă",
	"something-went-wrong": "Ceva nu a mers bine",
};

for (const key of Object.keys(en)) {
	if (!(key in ro)) {
		throw new Error(`Missing ro translation for ${key}`);
	}
}
for (const key of Object.keys(ro)) {
	if (!(key in en)) {
		throw new Error(`Extra ro key ${key}`);
	}
}

function writeLocale(locale, namespace, data) {
	const path = join(root, "src/locales", locale, `${namespace}.json`);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`);
}

writeLocale("en-US", "errors", en);
writeLocale("ro-RO", "errors", ro);
console.log(`Wrote ${Object.keys(en).length} error strings`);
