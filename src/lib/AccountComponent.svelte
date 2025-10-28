<script lang="ts">
  import type { AccountMetadata } from "./pdsfetch";
  const { account, welcome }: { account: AccountMetadata; welcome?: boolean } = $props();
  import { Config } from "../../config";
</script>

<a id="link" href="{Config.FRONTEND_URL}/profile/{account.handle || account.did}">
  <div id="accountContainer">
    {#if account.avatarCid}
      <img
        id="avatar"
        alt="avatar of {account.displayName}"
        src="{Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did={account.did}&cid={account.avatarCid}"
      />
      <div style="display: flex; flex-direction: column; width: 100%">
        {#if welcome}
        <div id="accountName">
          Welcome to our latest member... 
        </div>
        {/if}
        <div id="accountName">
          {account.displayName || account.handle || account.did}
        </div>
      </div>
    {:else}
      <div style="display: flex; flex-direction: column; width: 100%">
        {#if welcome}
        <div id="accountName">
          A big welcome to our latest member... 
        </div>
        {/if}
        <div id="accountName">
          {account.displayName || account.handle || account.did}
        </div>
      </div>
    {/if}
    <div class="tooltip">
      <i class="fa fa-info-circle" style="font-size: 20px"></i>
      <span class="tooltiptext">{account.did}</span>
    </div>
  </div>
</a>
