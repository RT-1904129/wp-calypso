import { isEnabled } from '@automattic/calypso-config';
import { translate } from 'i18n-calypso';
import page from 'page';
import { getSelectedSite } from 'calypso/state/ui/selectors';
import AddOnsMain from './main';

export const addOnsSiteSelectionHeader = ( context: PageJS.Context, next: () => void ) => {
	context.getSiteSelectionHeaderText = () => {
		return translate( 'Select a site to open {{strong}}Add-Ons{{/strong}}', {
			components: {
				strong: <strong />,
			},
		} );
	};

	next();
};

export const addOnsManagement = ( context: PageJS.Context, next: () => void ) => {
	const state = context.store.getState();
	const selectedSite = getSelectedSite( state );

	if ( ! selectedSite ) {
		page.redirect( '/add-ons' );

		return null;
	}

	context.primary = <AddOnsMain context={ context } />;

	next();
};

export const redirectIfNotEnabled = ( context: PageJS.Context, next: () => void ) => {
	const state = context.store.getState();
	const selectedSite = getSelectedSite( state );

	if ( ! isEnabled( 'my-sites/add-ons' ) ) {
		page.redirect( selectedSite ? `/home/${ selectedSite.slug }` : '/home' );
		return null;
	}

	next();
};
