/**
 * @jest-environment jsdom
 */

import flows from 'calypso/signup/config/flows';
import { useNock } from 'calypso/test-helpers/use-nock';
import { createSiteWithCart, isDomainFulfilled, isPlanFulfilled } from '../step-actions';

jest.mock( 'calypso/signup/config/steps', () => require( './mocks/signup/config/steps' ) );
jest.mock( 'calypso/signup/config/flows', () => require( './mocks/signup/config/flows' ) );
jest.mock( 'calypso/signup/config/flows-pure', () =>
	require( './mocks/signup/config/flows-pure' )
);

describe( 'createSiteWithCart()', () => {
	// createSiteWithCart() function is not designed to be easy for test at the moment.
	// Thus we intentionally mock the failing case here so that the parts we want to test
	// would be easier to write.
	useNock( ( nock ) => {
		nock( 'https://public-api.wordpress.com:443' )
			.persist()
			.post( '/rest/v1.1/sites/new' )
			.reply( 400, function ( uri, requestBody ) {
				return {
					error: 'error',
					message: 'something goes wrong!',
					requestBody,
				};
			} );
	} );

	test( 'should find available url if siteUrl is empty and enable auto generated blog name', () => {
		const fakeStore = {
			getState: () => ( {
				signup: { dependencyStore: { shouldHideFreePlan: true } },
			} ),
		};

		createSiteWithCart(
			( response ) => {
				expect( response.requestBody.find_available_url ).toBe( true );
			},
			[],
			{ siteUrl: undefined },
			fakeStore
		);
	} );

	test( "don't automatically find available url if siteUrl is defined", () => {
		const fakeStore = {
			getState: () => ( {} ),
		};

		createSiteWithCart(
			( response ) => {
				expect( response.requestBody.find_available_url ).toBeFalsy();
			},
			[],
			{ siteUrl: 'mysite' },
			fakeStore
		);
	} );

	test( 'use username for blog_name if user data available and enable auto generated blog name', () => {
		const fakeStore = {
			getState: () => ( {
				currentUser: {
					user: {
						username: 'alex',
					},
				},
				signup: { dependencyStore: { shouldHideFreePlan: true } },
			} ),
		};

		createSiteWithCart(
			( response ) => {
				expect( response.requestBody.blog_name ).toBe( 'alex' );
			},
			[],
			{ siteUrl: undefined },
			fakeStore
		);
	} );

	test( "use username from dependency store for blog_name if user data isn't available and enable auto generated blog name", () => {
		const fakeStore = {
			getState: () => ( {
				signup: { dependencyStore: { username: 'alex', shouldHideFreePlan: true } },
			} ),
		};

		createSiteWithCart(
			( response ) => {
				expect( response.requestBody.blog_name ).toBe( 'alex' );
			},
			[],
			{ siteUrl: undefined },
			fakeStore
		);
	} );

	test( "use site title for blog_name if username isn't available and enable auto generated blog name", () => {
		const fakeStore = {
			getState: () => ( {
				signup: { steps: { siteTitle: 'mytitle' }, dependencyStore: { shouldHideFreePlan: true } },
			} ),
		};

		createSiteWithCart(
			( response ) => {
				expect( response.requestBody.blog_name ).toBe( 'mytitle' );
			},
			[],
			{ siteUrl: undefined },
			fakeStore
		);
	} );

	test( "use site type for blog_name if username and title aren't available and enable auto generated blog name", () => {
		const fakeStore = {
			getState: () => ( {
				signup: { steps: { siteType: 'blog' }, dependencyStore: { shouldHideFreePlan: true } },
			} ),
		};

		createSiteWithCart(
			( response ) => {
				expect( response.requestBody.blog_name ).toBe( 'blog' );
			},
			[],
			{ siteUrl: undefined },
			fakeStore
		);
	} );
} );

describe( 'isDomainFulfilled', () => {
	const submitSignupStep = jest.fn();
	const oneDomain = [ { domain: 'example.wordpress.com' } ];
	const twoDomains = [ { domain: 'example.wordpress.com' }, { domain: 'example.com' } ];

	beforeEach( () => {
		flows.excludeStep.mockClear();
		submitSignupStep.mockClear();
	} );

	test( 'should call `submitSignupStep` with empty domainItem', () => {
		const stepName = 'domains-launch';
		const nextProps = { siteDomains: twoDomains, submitSignupStep };

		expect( submitSignupStep ).not.toHaveBeenCalled();

		isDomainFulfilled( stepName, undefined, nextProps );

		expect( submitSignupStep ).toHaveBeenCalledWith(
			{ stepName, domainItem: undefined },
			{ domainItem: undefined }
		);
	} );

	test( 'should call `flows.excludeStep` with the stepName', () => {
		const stepName = 'domains-launch';
		const nextProps = { siteDomains: twoDomains, submitSignupStep };

		expect( flows.excludeStep ).not.toHaveBeenCalled();

		isDomainFulfilled( stepName, undefined, nextProps );

		expect( flows.excludeStep ).toHaveBeenCalledWith( stepName );
	} );

	test( 'should not remove unfulfilled step', () => {
		const stepName = 'domains-launch';
		const nextProps = { siteDomains: oneDomain, submitSignupStep };

		expect( flows.excludeStep ).not.toHaveBeenCalled();
		expect( submitSignupStep ).not.toHaveBeenCalled();

		isDomainFulfilled( stepName, undefined, nextProps );

		expect( submitSignupStep ).not.toHaveBeenCalled();
		expect( flows.excludeStep ).not.toHaveBeenCalled();
	} );
} );

describe( 'isPlanFulfilled()', () => {
	const submitSignupStep = jest.fn();

	beforeEach( () => {
		flows.excludeStep.mockClear();
		submitSignupStep.mockClear();
	} );

	test( 'should remove a step for existing paid plan', () => {
		const stepName = 'plans';
		const nextProps = {
			isPaidPlan: true,
			sitePlanSlug: 'sitePlanSlug',
			submitSignupStep,
		};

		expect( flows.excludeStep ).not.toHaveBeenCalled();
		expect( submitSignupStep ).not.toHaveBeenCalled();

		isPlanFulfilled( stepName, undefined, nextProps );

		expect( submitSignupStep ).toHaveBeenCalledWith(
			{ stepName, undefined, wasSkipped: true },
			{ cartItem: undefined }
		);
		expect( flows.excludeStep ).toHaveBeenCalledWith( stepName );
	} );

	test( 'should remove a step when provided a cartItem default dependency', () => {
		const stepName = 'plans';
		const nextProps = {
			isPaidPlan: false,
			sitePlanSlug: 'sitePlanSlug',
			submitSignupStep,
		};
		const defaultDependencies = { cartItem: 'testPlan' };
		const cartItem = { product_slug: defaultDependencies.cartItem };

		expect( flows.excludeStep ).not.toHaveBeenCalled();
		expect( submitSignupStep ).not.toHaveBeenCalled();

		isPlanFulfilled( stepName, defaultDependencies, nextProps );

		expect( submitSignupStep ).toHaveBeenCalledWith(
			{ stepName, cartItem, wasSkipped: true },
			{ cartItem }
		);
		expect( flows.excludeStep ).toHaveBeenCalledWith( stepName );
	} );

	test( 'should not remove unfulfilled step', () => {
		const stepName = 'plans';
		const nextProps = {
			isPaidPlan: false,
			sitePlanSlug: 'sitePlanSlug',
			submitSignupStep,
		};

		expect( flows.excludeStep ).not.toHaveBeenCalled();
		expect( submitSignupStep ).not.toHaveBeenCalled();

		isPlanFulfilled( stepName, undefined, nextProps );

		expect( flows.excludeStep ).not.toHaveBeenCalled();
		expect( submitSignupStep ).not.toHaveBeenCalled();
	} );
} );
