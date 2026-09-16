import OAuth2Strategy = require('passport-oauth2');
import { Request } from 'express';

export interface YandexProfile {
    id: string;
    login?: string;
    client_id?: string;
    psuid?: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
    real_name?: string;
    sex?: 'male' | 'female' | null;
    default_email?: string;
    emails?: string[];
    is_avatar_empty?: boolean;
    default_avatar_id?: string;
    birthday?: string;
    default_phone?: { id: number; number: string };
    [key: string]: unknown;
}
export interface Profile {
    provider: 'yandex';
    id: string;
    username?: string;
    displayName?: string;
    name: { givenName?: string; familyName?: string };
    gender?: 'male' | 'female';
    psuid?: string;
    emails: { value: string }[];
    photos: { value: string; type: 'thumbnail' }[];
    _raw: string;
    _json: YandexProfile;
}
export interface YandexParameters {
    login_hint?: string;
    force_confirm?: boolean | 'yes' | 'true' | '1';
    optional_scope?: string | string[];
    device_id?: string;
    device_name?: string;
}
export interface PKCEStateStore {
    store(req: Request, verifier: string, state: unknown, meta: OAuth2Strategy.Metadata,
        done: (error: Error | null, state?: string) => void): void;
    verify(req: Request, state: string, meta: OAuth2Strategy.Metadata,
        done: (error: Error | null, verifier: string | false, state?: unknown) => void): void;
}
export interface StrategyOptions extends Omit<OAuth2Strategy.StrategyOptions,
    'authorizationURL' | 'tokenURL' | 'clientSecret' | 'pkce' | 'state' | 'store' | 'skipUserProfile'>,
    YandexParameters {
    authorizationURL?: string;
    tokenURL?: string;
    clientSecret?: string;
    pkce?: boolean | 'S256' | 'plain';
    state?: boolean;
    store?: OAuth2Strategy.StateStore | PKCEStateStore;
    skipUserProfile?: false;
}
export interface StrategyOptionsWithRequest extends Omit<StrategyOptions, 'passReqToCallback'> {
    passReqToCallback: true;
}
export interface TokenResponse {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
    [key: string]: unknown;
}
export type VerifyDone<U = Express.User> = (error: Error | null, user?: U | false, info?: object) => void;
export type VerifyCallback<U = Express.User> =
    (accessToken: string, refreshToken: string | undefined, profile: Profile, done: VerifyDone<U>) => void;
export type VerifyCallbackWithResults<U = Express.User> =
    (accessToken: string, refreshToken: string | undefined, results: TokenResponse, profile: Profile, done: VerifyDone<U>) => void;
export type VerifyCallbackWithRequest<U = Express.User> =
    (req: Request, accessToken: string, refreshToken: string | undefined, profile: Profile, done: VerifyDone<U>) => void;
export type VerifyCallbackWithRequestAndResults<U = Express.User> =
    (req: Request, accessToken: string, refreshToken: string | undefined, results: TokenResponse, profile: Profile, done: VerifyDone<U>) => void;
export class Strategy<U = Express.User> extends OAuth2Strategy {
    constructor(options: StrategyOptions, verify: VerifyCallback<U>);
    constructor(options: StrategyOptions, verify: VerifyCallbackWithResults<U>);
    constructor(options: StrategyOptionsWithRequest, verify: VerifyCallbackWithRequest<U>);
    constructor(options: StrategyOptionsWithRequest, verify: VerifyCallbackWithRequestAndResults<U>);
    userProfile(accessToken: string, done: (error: Error | null, profile?: Profile) => void): void;
    authorizationParams(options?: YandexParameters): Record<string, string>;
    tokenParams(options?: YandexParameters): Record<string, string>;
}
export const version: string;
