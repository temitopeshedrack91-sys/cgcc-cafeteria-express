<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Enforce vendor stock actions at the menu stock-write boundary as well as RPC entry points, so every allocation path respects per-account permissions.
- Use `src/lib/vendor-permissions.ts` for the matching interface checks; database rules remain authoritative.
- Vendor creation must never adopt or reset an existing auth account; roll back a newly created login if role or vendor creation fails.
- Customer menu, cart and checkout use database-fed store products; legacy category grouping is presentation-only and never changes vendor ownership.
- Browser payment simulations never settle orders; provider callbacks remain disabled until a verified provider integration replaces them.
- Payment return uses a non-nested file route so the checkout page cannot hide the return screen while its public URL stays unchanged.
