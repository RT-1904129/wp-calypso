import { isEnabled } from '@automattic/calypso-config';
import { Button } from '@automattic/components';
import { Modal, ToggleControl } from '@wordpress/components';
import { useTranslate } from 'i18n-calypso';
import { useCallback, useEffect, useState } from 'react';
import clockIcon from 'calypso/assets/images/jetpack/clock-icon.svg';
import SelectDropdown from 'calypso/components/select-dropdown';
import { useUpdateMonitorSettings, useJetpackAgencyDashboardRecordTrackEvent } from '../../hooks';
import {
	availableNotificationDurations as durations,
	getSiteCountText,
	mobileAppLink,
} from '../../sites-overview/utils';
import ConfigureEmailNotification from '../configure-email-notification';
import EmailAddressEditor from '../configure-email-notification/email-address-editor';
import type {
	MonitorSettings,
	Site,
	StateMonitorSettingsEmail,
	AllowedMonitorContactActions,
	MonitorSettingsEmail,
	UpdateMonitorSettingsParams,
} from '../../sites-overview/types';

import './style.scss';

type Duration = { label: string; time: number };

interface Props {
	sites: Array< Site >;
	onClose: () => void;
	settings?: MonitorSettings;
	bulkUpdateSettings?: MonitorSettings;
	isLargeScreen?: boolean;
}

export default function NotificationSettings( {
	onClose,
	sites,
	settings,
	bulkUpdateSettings,
	isLargeScreen,
}: Props ) {
	const isBulkUpdate = !! bulkUpdateSettings;
	const translate = useTranslate();
	const { updateMonitorSettings, isLoading, isComplete } = useUpdateMonitorSettings( sites );
	const recordEvent = useJetpackAgencyDashboardRecordTrackEvent( sites, isLargeScreen );

	const defaultDuration = durations.find( ( duration ) => duration.time === 5 );

	const [ enableMobileNotification, setEnableMobileNotification ] = useState< boolean >( false );
	const [ enableEmailNotification, setEnableEmailNotification ] = useState< boolean >( false );
	const [ selectedDuration, setSelectedDuration ] = useState< Duration | undefined >(
		defaultDuration
	);
	const [ defaultUserEmailAddresses, setDefaultUserEmailAddresses ] = useState< string[] | [] >(
		[]
	);
	const [ allEmailItems, setAllEmailItems ] = useState< StateMonitorSettingsEmail[] | [] >( [] );
	const [ validationError, setValidationError ] = useState< string >( '' );
	const [ isAddEmailModalOpen, setIsAddEmailModalOpen ] = useState< boolean >( false );
	const [ selectedEmail, setSelectedEmail ] = useState< StateMonitorSettingsEmail | undefined >();
	const [ selectedAction, setSelectedAction ] = useState< AllowedMonitorContactActions >();

	const isMultipleEmailEnabled = isEnabled(
		'jetpack/pro-dashboard-monitor-multiple-email-recipients'
	);

	const toggleAddEmailModal = (
		item?: StateMonitorSettingsEmail,
		action?: AllowedMonitorContactActions
	) => {
		if ( item && action ) {
			setSelectedEmail( item );
			setSelectedAction( action );
		}
		setIsAddEmailModalOpen( ( isAddEmailModalOpen ) => ! isAddEmailModalOpen );
		if ( isAddEmailModalOpen ) {
			setSelectedEmail( undefined );
			setSelectedAction( undefined );
		}
	};

	function onSave( event: React.FormEvent< HTMLFormElement > ) {
		event.preventDefault();
		if ( ! enableMobileNotification && ! enableEmailNotification ) {
			return setValidationError( translate( 'Please select at least one contact method.' ) );
		}
		const params = {
			wp_note_notifications: enableMobileNotification,
			email_notifications: enableEmailNotification,
			jetmon_defer_status_down_minutes: selectedDuration?.time,
		} as UpdateMonitorSettingsParams;

		const eventParams = { ...params } as any; // Adding eventParams since parameters for tracking events should be flat, not nested.

		if ( isMultipleEmailEnabled ) {
			const extraEmails = allEmailItems.filter( ( item ) => ! item.isDefault );
			params.contacts = {
				emails: extraEmails.map( ( item ) => {
					return {
						name: item.name,
						email_address: item.email,
						verified: item.verified,
					};
				} ),
			};
			eventParams.email_contacts = params.contacts.emails.length;
		}
		recordEvent( 'notification_save_click', eventParams );
		updateMonitorSettings( params );
	}

	function selectDuration( duration: Duration ) {
		recordEvent( 'duration_select', { duration: duration.time } );
		setSelectedDuration( duration );
	}

	const handleSetEmailItems = useCallback(
		( settings: MonitorSettings ) => {
			const userEmails = settings.monitor_user_emails || [];
			setDefaultUserEmailAddresses( userEmails );

			if ( isMultipleEmailEnabled ) {
				const userEmailItems = userEmails.map( ( email ) => ( {
					email,
					name: translate( 'Default account email' ),
					isDefault: true,
					verified: true,
				} ) );
				let siteEmailItems: Array< MonitorSettingsEmail > = [];
				if ( ! isBulkUpdate && settings.monitor_notify_additional_user_emails ) {
					siteEmailItems = settings.monitor_notify_additional_user_emails.map( ( item ) => ( {
						email: item.email_address,
						name: item.name,
						verified: item.verified,
					} ) );
				}
				setAllEmailItems( [ ...userEmailItems, ...siteEmailItems ] );
			}
		},
		[ isBulkUpdate, isMultipleEmailEnabled, translate ]
	);

	useEffect( () => {
		if ( settings?.monitor_deferment_time ) {
			const foundDuration = durations.find(
				( duration ) => duration.time === settings.monitor_deferment_time
			);
			foundDuration && setSelectedDuration( foundDuration );
		}
	}, [ settings?.monitor_deferment_time ] );

	useEffect( () => {
		if ( settings ) {
			handleSetEmailItems( settings );
			setEnableEmailNotification( !! settings.monitor_user_email_notifications );
			setEnableMobileNotification( !! settings.monitor_user_wp_note_notifications );
		}
	}, [ handleSetEmailItems, settings ] );

	useEffect( () => {
		if ( bulkUpdateSettings ) {
			handleSetEmailItems( bulkUpdateSettings );
		}
	}, [ handleSetEmailItems, bulkUpdateSettings ] );

	useEffect( () => {
		if ( enableMobileNotification || enableEmailNotification ) {
			setValidationError( '' );
		}
	}, [ enableMobileNotification, enableEmailNotification ] );

	useEffect( () => {
		if ( isComplete ) {
			onClose();
		}
	}, [ isComplete, onClose ] );

	if ( isAddEmailModalOpen ) {
		return (
			<EmailAddressEditor
				toggleModal={ toggleAddEmailModal }
				selectedEmail={ selectedEmail }
				selectedAction={ selectedAction }
				allEmailItems={ allEmailItems }
				setAllEmailItems={ setAllEmailItems }
				recordEvent={ recordEvent }
			/>
		);
	}

	return (
		<Modal
			open={ true }
			onRequestClose={ onClose }
			title={ translate( 'Set custom notification' ) }
			className="notification-settings__modal"
		>
			<div className="notification-settings__sub-title">{ getSiteCountText( sites ) }</div>

			<form onSubmit={ onSave }>
				<div className="notification-settings__content">
					<div className="notification-settings__content-block">
						<div className="notification-settings__content-heading">
							{ translate( 'Notify me about downtime:' ) }
						</div>
						<SelectDropdown
							onToggle={ ( { open: isOpen }: { open: boolean } ) => {
								if ( isOpen ) {
									recordEvent( 'notification_duration_toggle' );
								}
							} }
							selectedIcon={
								<img
									className="notification-settings__duration-icon"
									src={ clockIcon }
									alt={ translate( 'Schedules' ) }
								/>
							}
							selectedText={ selectedDuration?.label }
						>
							{ durations.map( ( duration ) => (
								<SelectDropdown.Item
									key={ duration.time }
									selected={ duration.time === selectedDuration?.time }
									onClick={ () => selectDuration( duration ) }
								>
									{ duration.label }
								</SelectDropdown.Item>
							) ) }
						</SelectDropdown>
					</div>
					<div className="notification-settings__toggle-container">
						<div className="notification-settings__toggle">
							<ToggleControl
								onChange={ ( isEnabled ) => {
									recordEvent(
										isEnabled ? 'mobile_notification_enable' : 'mobile_notification_disable'
									);
									setEnableMobileNotification( isEnabled );
								} }
								checked={ enableMobileNotification }
							/>
						</div>
						<div className="notification-settings__toggle-content">
							<div className="notification-settings__content-heading">
								{ translate( 'Mobile' ) }
							</div>
							<div className="notification-settings__content-sub-heading">
								{ translate( 'Receive notifications via the {{a}}Jetpack App{{/a}}.', {
									components: {
										a: (
											<a
												className="notification-settings__link"
												target="_blank"
												rel="noreferrer"
												href={ mobileAppLink }
											/>
										),
									},
								} ) }
							</div>
						</div>
					</div>
					<div className="notification-settings__toggle-container">
						<div className="notification-settings__toggle">
							<ToggleControl
								onChange={ ( isEnabled ) => {
									recordEvent(
										isEnabled ? 'email_notification_enable' : 'email_notification_disable'
									);
									setEnableEmailNotification( isEnabled );
								} }
								checked={ enableEmailNotification }
							/>
						</div>
						<div className="notification-settings__toggle-content">
							<div className="notification-settings__content-heading">{ translate( 'Email' ) }</div>
							{ isMultipleEmailEnabled ? (
								<>
									<div className="notification-settings__content-sub-heading">
										{ translate( 'Receive email notifications with one or more recipients.' ) }
									</div>
								</>
							) : (
								<div className="notification-settings__content-sub-heading">
									{ translate( 'Receive email notifications with your account email address %s.', {
										args: defaultUserEmailAddresses,
									} ) }
								</div>
							) }
						</div>
					</div>

					{ enableEmailNotification && isMultipleEmailEnabled && (
						<ConfigureEmailNotification
							toggleModal={ toggleAddEmailModal }
							allEmailItems={ allEmailItems }
							recordEvent={ recordEvent }
						/>
					) }
				</div>

				<div className="notification-settings__footer">
					{ validationError && (
						<div className="notification-settings__footer-validation-error">
							{ validationError }
						</div>
					) }
					<div className="notification-settings__footer-buttons">
						<Button
							onClick={ onClose }
							aria-label={ translate( 'Cancel and close notification settings popup' ) }
						>
							{ translate( 'Cancel' ) }
						</Button>
						<Button
							disabled={ !! validationError || isLoading }
							type="submit"
							primary
							aria-label={ translate( 'Save notification settings' ) }
						>
							{ isLoading ? translate( 'Saving Changes' ) : translate( 'Save' ) }
						</Button>
					</div>
				</div>
			</form>
		</Modal>
	);
}
