// Minimal type declarations for Google Identity Services (GIS)

declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
    select_by: string;
  }

  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }

  function initialize(config: IdConfiguration): void;
  function prompt(
    momentListener?: (notification: {
      isNotDisplayed: () => boolean;
      isSkippedMoment: () => boolean;
    }) => void
  ): void;
  function disableAutoSelect(): void;
  function renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: string;
      shape?: string;
      width?: number;
    }
  ): void;
}

declare namespace google.accounts.oauth2 {
  interface NonOAuthError {
    type?: "popup_failed_to_open" | "popup_closed" | "unknown";
  }

  interface TokenClient {
    callback: (response: TokenResponse) => void;
    error_callback?: (error: NonOAuthError) => void;
    requestAccessToken(overrides?: { prompt?: string }): void;
  }

  interface TokenResponse {
    access_token: string;
    error?: string;
    error_description?: string;
    error_uri?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }

  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: NonOAuthError) => void;
  }): TokenClient;

  interface CodeResponse {
    code: string;
    error?: string;
    error_description?: string;
    error_uri?: string;
    scope: string;
    state?: string;
  }

  interface CodeClient {
    callback: (response: CodeResponse) => void;
    error_callback?: (error: NonOAuthError) => void;
    requestCode(overrides?: { state?: string; scope?: string }): void;
  }

  function initCodeClient(config: {
    client_id: string;
    scope: string;
    callback: (response: CodeResponse) => void;
    error_callback?: (error: NonOAuthError) => void;
    redirect_uri?: string;
    state?: string;
  }): CodeClient;
}

interface Window {
  google: typeof google;
}
