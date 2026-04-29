/**
 * Parse a pasted workspace invite: full URL, path+query, or raw JWT.
 * @param {string} raw
 * @returns {{ workspaceId: string | null, token: string } | null}
 */
export function parseWorkspaceInviteInput(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return null;

  // Base64url JWT shape (optional `=` padding on segments)
  const jwtPattern =
    /^[A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+=*\.[A-Za-z0-9_-]+=*$/;

  const hasInviteQuery = /[?&]invite=/i.test(trimmed);
  const hasWorkspacePath = /\/workspace\/[^/?#]+/i.test(trimmed);

  if (hasInviteQuery || hasWorkspacePath || /^https?:\/\//i.test(trimmed)) {
    let href = trimmed;
    if (!/^https?:\/\//i.test(href) && !href.startsWith("/")) {
      href = `http://local/${href.replace(/^\/*/, "")}`;
    } else if (href.startsWith("/")) {
      href = `http://local${href}`;
    }

    try {
      const u = new URL(href);
      const tokenParam = u.searchParams.get("invite");
      if (tokenParam) {
        const token = tokenParam.trim();
        const pathMatch = u.pathname.match(/\/workspace\/([^/]+)/);
        const workspaceId = pathMatch ? pathMatch[1] : null;
        return { workspaceId, token };
      }
    } catch (_e) {
      // fall through
    }

    const inviteMatch = trimmed.match(/[?&]invite=([^&#]+)/);
    const wsMatch = trimmed.match(/\/workspace\/([^/?#]+)/);
    if (inviteMatch) {
      let token = inviteMatch[1];
      try {
        token = decodeURIComponent(token);
      } catch (_e) {
        /* keep raw */
      }
      const workspaceId = wsMatch ? wsMatch[1] : null;
      return { workspaceId, token: token.trim() };
    }
  }

  if (jwtPattern.test(trimmed)) {
    return { workspaceId: null, token: trimmed };
  }

  return null;
}
