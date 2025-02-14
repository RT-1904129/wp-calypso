import { isEnabled } from '@automattic/calypso-config';
import { createStore, applyMiddleware, compose } from 'redux';
import dynamicMiddlewares from 'redux-dynamic-middlewares';
import thunkMiddleware from 'redux-thunk';
import wpcomApiMiddleware from 'calypso/state/data-layer/wpcom-api-middleware';
import { addReducerEnhancer } from 'calypso/state/utils/add-reducer-enhancer';
import actionLogger from './action-log';
import consoleDispatcher from './console-dispatch';
import initialReducer from './reducer';

/**
 * @typedef {Object} ReduxStore
 * @property {!Function} dispatch dispatches actions
 * @property {!Function} getState returns the current state tree
 * @property {Function} replaceReducers replaces the state reducers
 * @property {Function} subscribe attaches an event listener to state changes
 */

export function createReduxStore( initialState, reducer = initialReducer ) {
	const isBrowser = typeof window === 'object';
	const isDesktop = isEnabled( 'desktop' );
	const isAudioSupported = typeof window === 'object' && typeof window.Audio === 'function';

	const middlewares = [
		thunkMiddleware,
		// We need the data layer middleware to be used as early
		// as possible, before any side effects.
		// The data layer dispatches actions on network events
		// including success, failure, and progress updates
		// Its way of issuing these is to wrap the originating action
		// with special meta and dispatch it again each time.
		// If another middleware jumps in before the data layer
		// then it could mistakenly trigger on those network
		// responses. Therefore we need to inject the data layer
		// as early as possible into the middleware chain.
		wpcomApiMiddleware,
		isBrowser && require( './happychat/middleware.js' ).default,
		isBrowser && require( './happychat/middleware-calypso.js' ).default,
		dynamicMiddlewares,
		isBrowser && require( './analytics/middleware.js' ).analyticsMiddleware,
		isBrowser && require( './lib/middleware.js' ).default,
		isAudioSupported && require( './audio/middleware.js' ).default,
		isDesktop && require( './desktop/middleware.js' ).default,
	].filter( Boolean );

	const enhancers = [
		addReducerEnhancer,
		isBrowser && window.app && window.app.isDebug && consoleDispatcher,
		applyMiddleware( ...middlewares ),
		isBrowser && window.app && window.app.isDebug && actionLogger,
		isBrowser && window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__(),
	].filter( Boolean );

	return createStore( reducer, initialState, compose( ...enhancers ) );
}
