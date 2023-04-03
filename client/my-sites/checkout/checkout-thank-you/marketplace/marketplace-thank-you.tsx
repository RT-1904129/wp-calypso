import { ConfettiAnimation } from '@automattic/components';
import { ThemeProvider, Global, css } from '@emotion/react';
import { useTranslate } from 'i18n-calypso';
import { useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ThankYou } from 'calypso/components/thank-you';
import PageViewTracker from 'calypso/lib/analytics/page-view-tracker';
import MarketplaceProgressBar from 'calypso/my-sites/marketplace/components/progressbar';
import useMarketplaceAdditionalSteps from 'calypso/my-sites/marketplace/pages/marketplace-plugin-install/use-marketplace-additional-steps';
import theme from 'calypso/my-sites/marketplace/theme';
import { requestAdminMenu } from 'calypso/state/admin-menu/actions';
import { transferStates } from 'calypso/state/automated-transfer/constants';
import { getAutomatedTransferStatus } from 'calypso/state/automated-transfer/selectors';
import { isRequesting } from 'calypso/state/plugins/installed/selectors';
import isSiteAutomatedTransfer from 'calypso/state/selectors/is-site-automated-transfer';
import { isJetpackSite } from 'calypso/state/sites/selectors';
import { getSelectedSiteId } from 'calypso/state/ui/selectors';
import { MarketplaceGoBackSection } from './marketplace-go-back-section';
import { useAtomicTransfer } from './use-atomic-transfer';
import { usePageTexts } from './use-page-texts';
import { usePluginsThankYouData } from './use-plugins-thank-you-data';
import { useThankYouFoooter } from './use-thank-you-footer';
import { useThemesThankYouData } from './use-themes-thank-you-data';

import './style.scss';

const MarketplaceThankYou = ( {
	pluginSlugs,
	themeSlugs,
}: {
	pluginSlugs: Array< string >;
	themeSlugs: Array< string >;
} ) => {
	const dispatch = useDispatch();
	const translate = useTranslate();
	const siteId = useSelector( getSelectedSiteId );
	const isRequestingPlugins = useSelector( ( state ) => isRequesting( state, siteId ) );

	const [
		pluginsSection,
		allPluginsFetched,
		pluginsGoBackSection,
		pluginTitle,
		pluginSubtitle,
		isAtomicNeededForPlugins,
	] = usePluginsThankYouData( pluginSlugs );
	const [
		themesSection,
		allThemesFetched,
		themesGoBackSection,
		themeTitle,
		themeSubtitle,
		isAtomicNeededForThemes,
	] = useThemesThankYouData( themeSlugs );

	const [ hasPlugins, hasThemes ] = [ pluginSlugs, themeSlugs ].map(
		( slugs ) => slugs.length !== 0
	);

	const defaultThankYouFooter = useThankYouFoooter( pluginSlugs, themeSlugs );
	const [ title, subtitle ] = usePageTexts( {
		pluginSlugs,
		themeSlugs,
		pluginTitle,
		pluginSubtitle,
		themeTitle,
		themeSubtitle,
	} );

	const isAtomicNeeded = isAtomicNeededForPlugins || isAtomicNeededForThemes;
	const [ isAtomicTransferCheckComplete, currentStep, showProgressBar, setShowProgressBar ] =
		useAtomicTransfer( isAtomicNeeded );

	const isPageReady = allPluginsFetched && allThemesFetched && isAtomicTransferCheckComplete;

	const transferStatus = useSelector( ( state ) => getAutomatedTransferStatus( state, siteId ) );
	const isJetpack = useSelector( ( state ) => isJetpackSite( state, siteId ) );
	const isAtomic = useSelector( ( state ) => isSiteAutomatedTransfer( state, siteId ) );
	const isJetpackSelfHosted = isJetpack && ! isAtomic;

	// Site is already Atomic (or just transferred).
	// Poll the plugin installation status.
	useEffect( () => {
		if ( ! siteId || ( ! isJetpackSelfHosted && transferStatus !== transferStates.COMPLETE ) ) {
			return;
		}

		// Update the menu after the plugin has been installed, since that might change some menu items.
		if ( isPageReady ) {
			dispatch( requestAdminMenu( siteId ) );
			return;
		}
	}, [ isRequestingPlugins, isPageReady, dispatch, siteId, transferStatus, isJetpackSelfHosted ] );

	// Set progressbar (currentStep) depending on transfer/plugin status.
	useEffect( () => {
		// We don't want to show the progress bar again when it is hidden.
		if ( ! showProgressBar ) {
			return;
		}

		setShowProgressBar( ! isPageReady );
	}, [ setShowProgressBar, showProgressBar, isPageReady ] );

	// TODO: Use more general steps (not specific to plugins)
	const steps = useMemo(
		() =>
			isJetpack
				? [ translate( 'Installing plugin' ) ]
				: [
						translate( 'Activating the plugin feature' ), // Transferring to Atomic
						translate( 'Setting up plugin installation' ), // Transferring to Atomic
						translate( 'Installing plugin' ), // Transferring to Atomic
						translate( 'Activating plugin' ),
				  ],
		// We intentionally don't set `isJetpack` as dependency to keep the same steps after the Atomic transfer.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ translate ]
	);
	const additionalSteps = useMarketplaceAdditionalSteps();
	const sections = [
		...( hasThemes ? [ themesSection ] : [] ),
		...( hasPlugins ? [ pluginsSection ] : [] ),
		defaultThankYouFooter,
	];

	return (
		<ThemeProvider theme={ theme }>
			<PageViewTracker path="/marketplace/thank-you/:site" title="Marketplace > Thank you" />
			{ /* Using Global to override Global masterbar height */ }
			<Global
				styles={ css`
					body.is-section-marketplace {
						--masterbar-height: 72px;
					}
				` }
			/>
			<MarketplaceGoBackSection
				pluginSlugs={ pluginSlugs }
				pluginsGoBackSection={ pluginsGoBackSection }
				themeSlugs={ themeSlugs }
				themesGoBackSection={ themesGoBackSection }
				areAllProductsFetched={ isPageReady }
			/>
			{ showProgressBar && (
				// eslint-disable-next-line wpcalypso/jsx-classname-namespace
				<div className="marketplace-plugin-install__root">
					<MarketplaceProgressBar
						steps={ steps }
						currentStep={ currentStep }
						additionalSteps={ additionalSteps }
					/>
				</div>
			) }
			{ ! showProgressBar && (
				<div className="marketplace-thank-you__container">
					<ConfettiAnimation delay={ 1000 } />
					<ThankYou
						containerClassName="marketplace-thank-you"
						sections={ sections }
						showSupportSection={ false }
						thankYouTitle={ title }
						thankYouSubtitle={ subtitle }
						headerBackgroundColor="#fff"
						headerTextColor="#000"
					/>
				</div>
			) }
		</ThemeProvider>
	);
};

export default MarketplaceThankYou;
