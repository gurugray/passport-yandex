import {Strategy as BaseStrategy} from 'passport';

export interface Profile {
    id: string;
    provider: string;
    displayName?: string;
    emails?: {value: string}[];
    gender?: string;
    username?: string;
    photos?: {
        value: string;
        type?: string;
    }[];
    [key: string]: any
}

interface Config {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
}

type Callback<U> = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: string | null, user: U) => void
) => void;

export class Strategy<U> extends BaseStrategy {
    public constructor(config: Config, callback: Callback<U>);
}
