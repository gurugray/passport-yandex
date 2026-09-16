import { Strategy, Profile, VerifyCallbackWithResults, VerifyCallbackWithRequestAndResults } from '..';
const options = { clientID: 'client', clientSecret: 'secret', callbackURL: '/callback' };
new Strategy<{ id: string }>(options, (access, refresh, profile, done) => {
    const id: string = profile.id;
    const token: string | undefined = refresh;
    done(null, { id });
    done(null, false);
    done(new Error('failed'));
    // @ts-expect-error Errors are not strings.
    done('failed');
});
new Strategy({ ...options, passReqToCallback: true, pkce: 'S256', state: true }, (req, access, refresh, profile, done) => {
    const url: string = req.url;
    const p: Profile = profile;
    done(null, { id: p.id });
});
const withResults: VerifyCallbackWithResults = (access, refresh, results, profile, done) => {
    const expires: number | undefined = results.expires_in;
    done(null, profile);
};
new Strategy(options, withResults);
const withRequestResults: VerifyCallbackWithRequestAndResults = (req, access, refresh, results, profile, done) => done(null, profile);
new Strategy({ ...options, passReqToCallback: true }, withRequestResults);
new Strategy({ clientID: 'public-client', optional_scope: ['login:avatar'] }, (a, r, p, done) => done(null, p));
// @ts-expect-error A client ID is required.
new Strategy({}, withResults);
