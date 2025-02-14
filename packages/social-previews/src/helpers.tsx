import { createInterpolateElement } from '@wordpress/element';
import { sprintf } from '@wordpress/i18n';

export type Formatter = ( text: string, options?: any ) => string;
type AugmentFormatterReturnType< T extends Formatter, TNewReturn > = (
	...a: Parameters< T >
) => ReturnType< T > | TNewReturn;
type ConditionalFormatter = AugmentFormatterReturnType< Formatter, boolean >;
type NullableFormatter = AugmentFormatterReturnType< Formatter, undefined >;

export const baseDomain = ( url: string ): string =>
	url
		.replace( /^[^/]+[/]*/, '' ) // strip leading protocol
		.replace( /\/.*$/, '' ); // strip everything after the domain

export const shortEnough: ( n: number ) => ConditionalFormatter = ( limit ) => ( title ) =>
	title.length <= limit ? title : false;

export const truncatedAtSpace: ( a: number, b: number ) => ConditionalFormatter =
	( lower, upper ) => ( fullTitle ) => {
		const title = fullTitle.slice( 0, upper );
		const lastSpace = title.lastIndexOf( ' ' );

		return lastSpace > lower && lastSpace < upper
			? title.slice( 0, lastSpace ).concat( '…' )
			: false;
	};

export const hardTruncation: ( n: number ) => Formatter = ( limit ) => ( title ) =>
	title.slice( 0, limit ).concat( '…' );

export const firstValid: ( ...args: ConditionalFormatter[] ) => NullableFormatter =
	( ...predicates ) =>
	( a ) =>
		( predicates.find( ( p ) => false !== p( a ) ) as Formatter )?.( a );

export const stripHtmlTags: Formatter = ( description, allowedTags = [] ) => {
	const pattern = new RegExp( `(<([^${ allowedTags.join( '' ) }>]+)>)`, 'gi' );

	return description ? description.replace( pattern, '' ) : '';
};

export const hasTag = ( text: string, tag: string ): boolean => {
	const pattern = new RegExp( `<${ tag }[^>]*>`, 'gi' );

	return pattern.test( text );
};

export const formatTweetDate = new Intl.DateTimeFormat( 'en-US', {
	// Result: "Apr 7", "Dec 31"
	month: 'short',
	day: 'numeric',
} ).format;

export type Platform = 'twitter' | 'facebook' | 'linkedin' | 'instagram' | 'mastodon';

type PreviewTextOptions = {
	platform: Platform;
	maxChars?: number;
	maxLines?: number;
	hyperlinkUrls?: boolean;
	hyperlinkHashtags?: boolean;
};

export const hashtagUrlMap: Record< Platform, string > = {
	twitter: 'https://twitter.com/hashtag/%s',
	facebook: 'https://www.facebook.com/hashtag/%s',
	linkedin: 'https://www.linkedin.com/feed/hashtag/?keywords=%s',
	instagram: 'https://www.instagram.com/explore/tags/%s',
	mastodon: 'https://mastodon.social/tags/%s',
};

/**
 * Prepares the text for the preview.
 */
export function preparePreviewText( text: string, options: PreviewTextOptions ): React.ReactNode {
	const {
		platform,
		maxChars,
		maxLines,
		hyperlinkHashtags = true,
		// Instagram doesn't support hyperlink URLs at the moment.
		hyperlinkUrls = 'instagram' !== platform,
	} = options;

	let result = stripHtmlTags( text );

	if ( maxChars && result.length > maxChars ) {
		result = result.substring( 0, maxChars );
	}

	if ( maxLines ) {
		const lines = result.split( '\n' );

		if ( lines.length > maxLines ) {
			result = lines.slice( 0, maxLines ).join( '\n' );
		}
	}

	const componentMap: Record< string, React.ReactNode > = {};

	if ( hyperlinkUrls ) {
		// Convert URLs to hyperlinks.
		// TODO: Use a better regex here to match the URLs without protocol.
		const urls = result.match( /(https?:\/\/\S+)/g ) || [];

		/**
		 * BEFORE:
		 * result = 'Check out this cool site: https://wordpress.org and this one: https://wordpress.com'
		 */
		urls.forEach( ( url, index ) => {
			// Add the element to the component map.
			componentMap[ `Link${ index }` ] = (
				<a href={ url } rel="noopener noreferrer" target="_blank">
					{ url }
				</a>
			);
			// Replace the URL with the component placeholder.
			result = result.replace( url, `<Link${ index } />` );
		} );
		/**
		 * AFTER:
		 * result = 'Check out this cool site: <Link0 /> and this one: <Link1 />'
		 * componentMap = {
		 *     Link0: <a href="https://wordpress.org" ...>https://wordpress.org</a>,
		 *     Link1: <a href="https://wordpress.com" ...>https://wordpress.com</a>
		 * }
		 */
	}

	// Convert hashtags to hyperlinks.
	if ( hyperlinkHashtags && hashtagUrlMap[ platform ] ) {
		/**
		 * We need to ensure that only the standalone hashtags are matched.
		 * For example, we don't want to match the hash in the URL.
		 * Thus we need to match the whitespace character before the hashtag or the beginning of the string.
		 */
		const hashtags = result.matchAll( /(^|\s)#(\w+)/g );

		const hashtagUrl = hashtagUrlMap[ platform ];

		/**
		 * BEFORE:
		 * result = `#breaking text with a #hashtag on the #web
		 * with a url https://github.com/Automattic/wp-calypso#security that has a hash in it`
		 */
		[ ...hashtags ].forEach( ( [ fullMatch, whitespace, hashtag ], index ) => {
			const url = sprintf( hashtagUrl, hashtag );

			// Add the element to the component map.
			componentMap[ `Hashtag${ index }` ] = (
				<a href={ url } rel="noopener noreferrer" target="_blank">
					{ `#${ hashtag }` }
				</a>
			);

			// Replace the hashtag with the component placeholder.
			result = result.replace( fullMatch, `${ whitespace }<Hashtag${ index } />` );
		} );
		/**
		 * AFTER:
		 * result = `<Hashtag0 /> text with a <Hashtag1 /> on the <Hashtag2 />
		 * with a url https://github.com/Automattic/wp-calypso#security that has a hash in it`
		 *
		 * componentMap = {
		 *    Hashtag0: <a href="https://twitter.com/hashtag/breaking" ...>#breaking</a>,
		 *    Hashtag1: <a href="https://twitter.com/hashtag/hashtag" ...>#hashtag</a>,
		 *    Hashtag2: <a href="https://twitter.com/hashtag/web" ...>#web</a>
		 * }
		 */
	}

	// Convert newlines to <br> tags.
	/**
	 * BEFORE:
	 * result = 'This is a text\nwith a newline\nin it'
	 */
	result = result.replace( /\n/g, '<br />' );
	componentMap.br = <br />;
	/**
	 * AFTER:
	 * result = 'This is a text<br />with a newline<br />in it'
	 * componentMap = { br: <br /> }
	 */

	return createInterpolateElement( result, componentMap );
}
