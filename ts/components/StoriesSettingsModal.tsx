// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MeasuredComponentProps } from 'react-measure';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Measure from 'react-measure';
import { noop } from 'lodash';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { Row } from './ConversationList';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories';
import type { UUIDStringType } from '../types/UUID';
import type { RenderModalPage, ModalPropsType } from './Modal';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonVariant } from './Button';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContactPills } from './ContactPills';
import { ContactPill } from './ContactPill';
import { ConversationList, RowType } from './ConversationList';
import { Input } from './Input';
import { Intl } from './Intl';
import { MY_STORIES_ID, getStoryDistributionListName } from '../types/Stories';
import { PagedModal, ModalPage } from './Modal';
import { SearchInput } from './SearchInput';
import { StoryDistributionListName } from './StoryDistributionListName';
import { Theme } from '../util/theme';
import { ThemeType } from '../types/Util';
import { UUID } from '../types/UUID';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';
import { isNotNil } from '../util/isNotNil';
import {
  shouldNeverBeCalled,
  asyncShouldNeverBeCalled,
} from '../util/shouldNeverBeCalled';

export type PropsType = {
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListWithMembersDataType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  hideStoriesSettings: () => unknown;
  i18n: LocalizerType;
  me: ConversationType;
  onDeleteList: (listId: string) => unknown;
  onDistributionListCreated: (
    name: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  onHideMyStoriesFrom: (viewerUuids: Array<UUIDStringType>) => unknown;
  onRemoveMember: (listId: string, uuid: UUIDStringType | undefined) => unknown;
  onRepliesNReactionsChanged: (
    listId: string,
    allowsReplies: boolean
  ) => unknown;
  onViewersUpdated: (
    listId: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  setMyStoriesToAllSignalConnections: () => unknown;
  toggleSignalConnectionsModal: () => unknown;
};

export enum Page {
  DistributionLists = 'DistributionLists',
  AddViewer = 'AddViewer',
  ChooseViewers = 'ChooseViewers',
  NameStory = 'NameStory',
  HideStoryFrom = 'HideStoryFrom',
}

function filterConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string
) {
  return filterAndSortConversationsByRecent(
    conversations,
    searchTerm,
    undefined
  ).filter(conversation => conversation.uuid);
}

const modalCommonProps: Pick<ModalPropsType, 'hasXButton' | 'moduleClassName'> =
  {
    hasXButton: true,
    moduleClassName: 'StoriesSettingsModal__modal',
  };

export const StoriesSettingsModal = ({
  candidateConversations,
  distributionLists,
  getPreferredBadge,
  hideStoriesSettings,
  i18n,
  me,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMember,
  onRepliesNReactionsChanged,
  onViewersUpdated,
  setMyStoriesToAllSignalConnections,
  toggleSignalConnectionsModal,
}: PropsType): JSX.Element => {
  const [listToEditId, setListToEditId] = useState<string | undefined>(
    undefined
  );

  const listToEdit = useMemo(
    () => distributionLists.find(x => x.id === listToEditId),
    [distributionLists, listToEditId]
  );

  const [page, setPage] = useState<Page>(Page.DistributionLists);

  const [selectedContacts, setSelectedContacts] = useState<
    Array<ConversationType>
  >([]);

  const resetChooseViewersScreen = useCallback(() => {
    setSelectedContacts([]);
    setPage(Page.DistributionLists);
  }, []);

  const [confirmDeleteListId, setConfirmDeleteListId] = useState<
    string | undefined
  >();

  let modal: RenderModalPage | null;

  if (page !== Page.DistributionLists) {
    const isChoosingViewers =
      page === Page.ChooseViewers || page === Page.AddViewer;

    modal = onClose => (
      <EditDistributionListModal
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        page={page}
        onClose={onClose}
        onCreateList={(name, uuids) => {
          onDistributionListCreated(name, uuids);
          resetChooseViewersScreen();
        }}
        onBackButtonClick={() => {
          if (page === Page.HideStoryFrom) {
            resetChooseViewersScreen();
          } else if (page === Page.NameStory) {
            setPage(Page.ChooseViewers);
          } else if (isChoosingViewers) {
            resetChooseViewersScreen();
          } else if (listToEdit) {
            setListToEditId(undefined);
          }
        }}
        onViewersUpdated={uuids => {
          if (listToEditId && page === Page.AddViewer) {
            onViewersUpdated(listToEditId, uuids);
            resetChooseViewersScreen();
          }

          if (page === Page.ChooseViewers) {
            setPage(Page.NameStory);
          }

          if (page === Page.HideStoryFrom) {
            onHideMyStoriesFrom(uuids);
            resetChooseViewersScreen();
          }
        }}
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
      />
    );
  } else if (listToEdit) {
    modal = onClose => (
      <DistributionListSettingsModal
        key="settings-modal"
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        listToEdit={listToEdit}
        onRemoveMember={onRemoveMember}
        onRepliesNReactionsChanged={onRepliesNReactionsChanged}
        setConfirmDeleteListId={setConfirmDeleteListId}
        setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
        setPage={setPage}
        setSelectedContacts={setSelectedContacts}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        onBackButtonClick={() => setListToEditId(undefined)}
        onClose={onClose}
      />
    );
  } else {
    const privateStories = distributionLists.filter(
      list => list.id !== MY_STORIES_ID
    );

    modal = onClose => (
      <ModalPage
        modalName="StoriesSettingsModal__list"
        i18n={i18n}
        onClose={onClose}
        title={i18n('StoriesSettings__title')}
        {...modalCommonProps}
      >
        <button
          className="StoriesSettingsModal__list"
          onClick={() => {
            setListToEditId(MY_STORIES_ID);
          }}
          type="button"
        >
          <span className="StoriesSettingsModal__list__left">
            <Avatar
              acceptedMessageRequest={me.acceptedMessageRequest}
              avatarPath={me.avatarPath}
              badge={getPreferredBadge(me.badges)}
              color={me.color}
              conversationType={me.type}
              i18n={i18n}
              isMe
              sharedGroupNames={me.sharedGroupNames}
              size={AvatarSize.THIRTY_SIX}
              theme={ThemeType.dark}
              title={me.title}
            />
            <span className="StoriesSettingsModal__list__title">
              {i18n('Stories__mine')}
            </span>
          </span>

          <span className="StoriesSettingsModal__list__viewers" />
        </button>

        <hr className="StoriesSettingsModal__divider" />

        <button
          className="StoriesSettingsModal__list"
          onClick={() => {
            setPage(Page.ChooseViewers);
          }}
          type="button"
        >
          <span className="StoriesSettingsModal__list__left">
            <span className="StoriesSettingsModal__list__avatar--new" />
            <span className="StoriesSettingsModal__list__title">
              {i18n('StoriesSettings__new-list')}
            </span>
          </span>
        </button>
        {privateStories.map(list => (
          <button
            className="StoriesSettingsModal__list"
            key={list.id}
            onClick={() => {
              setListToEditId(list.id);
            }}
            type="button"
          >
            <span className="StoriesSettingsModal__list__left">
              <span className="StoriesSettingsModal__list__avatar--private" />
              <span className="StoriesSettingsModal__list__title">
                {list.name}
              </span>
            </span>

            <span className="StoriesSettingsModal__list__viewers">
              {list.members.length === 1
                ? i18n('StoriesSettings__viewers--singular', ['1'])
                : i18n('StoriesSettings__viewers--plural', [
                    String(list.members.length),
                  ])}
            </span>
          </button>
        ))}
      </ModalPage>
    );
  }

  return (
    <>
      <PagedModal
        modalName="StoriesSettingsModal"
        theme={Theme.Dark}
        onClose={hideStoriesSettings}
      >
        {modal}
      </PagedModal>
      {confirmDeleteListId && (
        <ConfirmationDialog
          dialogName="StoriesSettings.deleteList"
          actions={[
            {
              action: () => {
                onDeleteList(confirmDeleteListId);
                setListToEditId(undefined);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteListId(undefined);
          }}
        >
          {i18n('StoriesSettings__delete-list--confirm')}
        </ConfirmationDialog>
      )}
    </>
  );
};

type DistributionListSettingsModalPropsType = {
  i18n: LocalizerType;
  listToEdit: StoryDistributionListWithMembersDataType;
  setConfirmDeleteListId: (id: string) => unknown;
  setPage: (page: Page) => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  onBackButtonClick: (() => void) | undefined;
  onClose: () => void;
} & Pick<
  PropsType,
  | 'getPreferredBadge'
  | 'onRemoveMember'
  | 'onRepliesNReactionsChanged'
  | 'setMyStoriesToAllSignalConnections'
  | 'toggleSignalConnectionsModal'
>;

export const DistributionListSettingsModal = ({
  getPreferredBadge,
  i18n,
  listToEdit,
  onRemoveMember,
  onRepliesNReactionsChanged,
  onBackButtonClick,
  onClose,
  setConfirmDeleteListId,
  setMyStoriesToAllSignalConnections,
  setPage,
  setSelectedContacts,
  toggleSignalConnectionsModal,
}: DistributionListSettingsModalPropsType): JSX.Element => {
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<
    | undefined
    | {
        listId: string;
        title: string;
        uuid: UUIDStringType | undefined;
      }
  >();

  const isMyStories = listToEdit.id === MY_STORIES_ID;

  const modalTitle = getStoryDistributionListName(
    i18n,
    listToEdit.id,
    listToEdit.name
  );

  return (
    <ModalPage
      modalName="DistributionListSettingsModal"
      i18n={i18n}
      onBackButtonClick={onBackButtonClick}
      onClose={onClose}
      title={modalTitle}
      {...modalCommonProps}
    >
      {!isMyStories && (
        <>
          <div className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer">
            <span className="StoriesSettingsModal__list__left">
              <span className="StoriesSettingsModal__list__avatar--private" />
              <span className="StoriesSettingsModal__list__title">
                <StoryDistributionListName
                  i18n={i18n}
                  id={listToEdit.id}
                  name={listToEdit.name}
                />
              </span>
            </span>
          </div>

          <hr className="StoriesSettingsModal__divider" />
        </>
      )}

      <div className="StoriesSettingsModal__title">
        {i18n('StoriesSettings__who-can-see')}
      </div>

      {isMyStories && (
        <EditMyStoriesPrivacy
          i18n={i18n}
          learnMore="StoriesSettings__mine_disclaimer"
          myStories={listToEdit}
          onClickExclude={() => {
            setPage(Page.HideStoryFrom);
          }}
          onClickOnlyShareWith={() => {
            setPage(Page.AddViewer);
          }}
          setSelectedContacts={setSelectedContacts}
          setMyStoriesToAllSignalConnections={
            setMyStoriesToAllSignalConnections
          }
          toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        />
      )}

      {!isMyStories && (
        <>
          <button
            className="StoriesSettingsModal__list"
            onClick={() => {
              setSelectedContacts(listToEdit.members);
              setPage(Page.AddViewer);
            }}
            type="button"
          >
            <span className="StoriesSettingsModal__list__left">
              <span className="StoriesSettingsModal__list__avatar--new" />
              <span className="StoriesSettingsModal__list__title">
                {i18n('StoriesSettings__add-viewer')}
              </span>
            </span>
          </button>

          {listToEdit.members.map(member => (
            <div
              className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer"
              key={member.id}
            >
              <span className="StoriesSettingsModal__list__left">
                <Avatar
                  acceptedMessageRequest={member.acceptedMessageRequest}
                  avatarPath={member.avatarPath}
                  badge={getPreferredBadge(member.badges)}
                  color={member.color}
                  conversationType={member.type}
                  i18n={i18n}
                  isMe
                  sharedGroupNames={member.sharedGroupNames}
                  size={AvatarSize.THIRTY_SIX}
                  theme={ThemeType.dark}
                  title={member.title}
                />
                <span className="StoriesSettingsModal__list__title">
                  {member.title}
                </span>
              </span>

              <button
                aria-label={i18n('StoriesSettings__remove--title', [
                  member.title,
                ])}
                className="StoriesSettingsModal__list__delete"
                onClick={() =>
                  setConfirmRemoveMember({
                    listId: listToEdit.id,
                    title: member.title,
                    uuid: member.uuid,
                  })
                }
                type="button"
              />
            </div>
          ))}
        </>
      )}

      <hr className="StoriesSettingsModal__divider" />

      <div className="StoriesSettingsModal__title">
        {i18n('StoriesSettings__replies-reactions--title')}
      </div>

      <Checkbox
        checked={listToEdit.allowsReplies}
        description={i18n('StoriesSettings__replies-reactions--description')}
        label={i18n('StoriesSettings__replies-reactions--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="replies-reactions"
        onChange={value => onRepliesNReactionsChanged(listToEdit.id, value)}
      />

      {!isMyStories && (
        <>
          <hr className="StoriesSettingsModal__divider" />

          <button
            className="StoriesSettingsModal__delete-list"
            onClick={() => setConfirmDeleteListId(listToEdit.id)}
            type="button"
          >
            {i18n('StoriesSettings__delete-list')}
          </button>
        </>
      )}

      {confirmRemoveMember && (
        <ConfirmationDialog
          dialogName="StoriesSettings.confirmRemoveMember"
          actions={[
            {
              action: () =>
                onRemoveMember(
                  confirmRemoveMember.listId,
                  confirmRemoveMember.uuid
                ),
              style: 'negative',
              text: i18n('StoriesSettings__remove--action'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveMember(undefined);
          }}
          title={i18n('StoriesSettings__remove--title', [
            confirmRemoveMember.title,
          ])}
        >
          {i18n('StoriesSettings__remove--body')}
        </ConfirmationDialog>
      )}
    </ModalPage>
  );
};

type EditMyStoriesPrivacyPropsType = {
  hasDisclaimerAbove?: boolean;
  i18n: LocalizerType;
  learnMore: string;
  myStories: StoryDistributionListWithMembersDataType;
  onClickExclude: () => unknown;
  onClickOnlyShareWith: () => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
} & Pick<
  PropsType,
  'setMyStoriesToAllSignalConnections' | 'toggleSignalConnectionsModal'
>;

export const EditMyStoriesPrivacy = ({
  hasDisclaimerAbove,
  i18n,
  learnMore,
  myStories,
  onClickExclude,
  onClickOnlyShareWith,
  setSelectedContacts,
  setMyStoriesToAllSignalConnections,
  toggleSignalConnectionsModal,
}: EditMyStoriesPrivacyPropsType): JSX.Element => {
  const disclaimerElement = (
    <div className="StoriesSettingsModal__disclaimer">
      <Intl
        components={{
          learnMore: (
            <button
              className="StoriesSettingsModal__disclaimer__learn-more"
              onClick={toggleSignalConnectionsModal}
              type="button"
            >
              {i18n('StoriesSettings__mine__disclaimer--learn-more')}
            </button>
          ),
        }}
        i18n={i18n}
        id={learnMore}
      />
    </div>
  );

  return (
    <>
      {hasDisclaimerAbove && disclaimerElement}

      <Checkbox
        checked={!myStories.members.length}
        description={i18n('StoriesSettings__mine__all--description')}
        isRadio
        label={i18n('StoriesSettings__mine__all--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={() => {
          setMyStoriesToAllSignalConnections();
        }}
      />

      <Checkbox
        checked={myStories.isBlockList && myStories.members.length > 0}
        description={i18n('StoriesSettings__mine__exclude--description', [
          myStories.isBlockList ? String(myStories.members.length) : '0',
        ])}
        isRadio
        label={i18n('StoriesSettings__mine__exclude--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={noop}
        onClick={() => {
          if (myStories.isBlockList) {
            setSelectedContacts(myStories.members);
          }
          onClickExclude();
        }}
      />

      <Checkbox
        checked={!myStories.isBlockList && myStories.members.length > 0}
        description={
          !myStories.isBlockList && myStories.members.length
            ? i18n('StoriesSettings__mine__only--description--people', [
                String(myStories.members.length),
              ])
            : i18n('StoriesSettings__mine__only--description')
        }
        isRadio
        label={i18n('StoriesSettings__mine__only--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={noop}
        onClick={() => {
          if (!myStories.isBlockList) {
            setSelectedContacts(myStories.members);
          }
          onClickOnlyShareWith();
        }}
      />

      {!hasDisclaimerAbove && disclaimerElement}
    </>
  );
};

type EditDistributionListModalPropsType = {
  onCreateList: (name: string, viewerUuids: Array<UUIDStringType>) => unknown;
  onViewersUpdated: (viewerUuids: Array<UUIDStringType>) => unknown;
  page:
    | Page.AddViewer
    | Page.ChooseViewers
    | Page.HideStoryFrom
    | Page.NameStory;
  selectedContacts: Array<ConversationType>;
  onClose: () => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  onBackButtonClick: () => void;
} & Pick<PropsType, 'candidateConversations' | 'getPreferredBadge' | 'i18n'>;

/**
 *
 * @param param0
 * @returns
 */
export const EditDistributionListModal = ({
  candidateConversations,
  getPreferredBadge,
  i18n,
  onCreateList,
  onViewersUpdated,
  page,
  onClose,
  selectedContacts,
  setSelectedContacts,
  onBackButtonClick,
}: EditDistributionListModalPropsType): JSX.Element => {
  const [storyName, setStoryName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearchTerm = searchTerm.trim();

  const [filteredConversations, setFilteredConversations] = useState(
    filterConversations(candidateConversations, normalizedSearchTerm)
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterConversations(candidateConversations, normalizedSearchTerm)
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [candidateConversations, normalizedSearchTerm, setFilteredConversations]);

  const contactLookup = useMemo(() => {
    const map = new Map();
    candidateConversations.forEach(contact => {
      map.set(contact.id, contact);
    });
    return map;
  }, [candidateConversations]);

  const selectedConversationUuids: Set<UUIDStringType> = useMemo(
    () =>
      new Set(selectedContacts.map(contact => contact.uuid).filter(isNotNil)),
    [selectedContacts]
  );

  const toggleSelectedConversation = useCallback(
    (conversationId: string) => {
      let removeContact = false;
      const nextSelectedContacts = selectedContacts.filter(contact => {
        if (contact.id === conversationId) {
          removeContact = true;
          return false;
        }
        return true;
      });
      if (removeContact) {
        setSelectedContacts(nextSelectedContacts);
        return;
      }
      const selectedContact = contactLookup.get(conversationId);
      if (selectedContact) {
        setSelectedContacts([...nextSelectedContacts, selectedContact]);
      }
    },
    [contactLookup, selectedContacts, setSelectedContacts]
  );

  const isChoosingViewers =
    page === Page.ChooseViewers || page === Page.AddViewer;

  if (page === Page.NameStory) {
    const footer = (
      <Button
        disabled={!storyName}
        onClick={() => {
          onCreateList(storyName, Array.from(selectedConversationUuids));
          setStoryName('');
        }}
        variant={ButtonVariant.Primary}
      >
        {i18n('done')}
      </Button>
    );

    return (
      <ModalPage
        modalName="StoriesSettings__name-story"
        title={i18n('StoriesSettings__name-story')}
        modalFooter={footer}
        i18n={i18n}
        onBackButtonClick={onBackButtonClick}
        onClose={onClose}
        {...modalCommonProps}
      >
        <div className="StoriesSettingsModal__name-story-avatar-container">
          <div className="StoriesSettingsModal__list__avatar--private StoriesSettingsModal__list__avatar--private--large" />
        </div>

        <Input
          i18n={i18n}
          onChange={setStoryName}
          placeholder={i18n('StoriesSettings__name-placeholder')}
          value={storyName}
        />

        <div className="StoriesSettingsModal__title">
          {i18n('StoriesSettings__who-can-see')}
        </div>

        {selectedContacts.map(contact => (
          <div
            className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer"
            key={contact.id}
          >
            <span className="StoriesSettingsModal__list__left">
              <Avatar
                acceptedMessageRequest={contact.acceptedMessageRequest}
                avatarPath={contact.avatarPath}
                badge={getPreferredBadge(contact.badges)}
                color={contact.color}
                conversationType={contact.type}
                i18n={i18n}
                isMe
                sharedGroupNames={contact.sharedGroupNames}
                size={AvatarSize.THIRTY_SIX}
                theme={ThemeType.dark}
                title={contact.title}
              />
              <span className="StoriesSettingsModal__list__title">
                {contact.title}
              </span>
            </span>
          </div>
        ))}
      </ModalPage>
    );
  }

  const rowCount = filteredConversations.length;
  const getRow = (index: number): undefined | Row => {
    const contact = filteredConversations[index];
    if (!contact || !contact.uuid) {
      return undefined;
    }

    const isSelected = selectedConversationUuids.has(UUID.cast(contact.uuid));

    return {
      type: RowType.ContactCheckbox,
      contact,
      isChecked: isSelected,
    };
  };

  let footer: JSX.Element | undefined;
  if (isChoosingViewers) {
    footer = (
      <Button
        disabled={selectedContacts.length === 0}
        onClick={() => {
          onViewersUpdated(Array.from(selectedConversationUuids));
        }}
        variant={ButtonVariant.Primary}
      >
        {page === Page.AddViewer ? i18n('done') : i18n('next2')}
      </Button>
    );
  } else if (page === Page.HideStoryFrom) {
    footer = (
      <Button
        disabled={selectedContacts.length === 0}
        onClick={() => {
          onViewersUpdated(Array.from(selectedConversationUuids));
        }}
        variant={ButtonVariant.Primary}
      >
        {i18n('update')}
      </Button>
    );
  }

  return (
    <ModalPage
      modalName={`EditDistributionListModal__${page}`}
      i18n={i18n}
      modalFooter={footer}
      onBackButtonClick={onBackButtonClick}
      onClose={onClose}
      title={
        page === Page.HideStoryFrom
          ? i18n('StoriesSettings__hide-story')
          : i18n('StoriesSettings__choose-viewers')
      }
      padded={page !== Page.ChooseViewers && page !== Page.AddViewer}
      {...modalCommonProps}
    >
      <SearchInput
        disabled={candidateConversations.length === 0}
        i18n={i18n}
        placeholder={i18n('contactSearchPlaceholder')}
        moduleClassName="StoriesSettingsModal__search"
        onChange={event => {
          setSearchTerm(event.target.value);
        }}
        value={searchTerm}
      />
      {selectedContacts.length ? (
        <ContactPills moduleClassName="StoriesSettingsModal__tags">
          {selectedContacts.map(contact => (
            <ContactPill
              key={contact.id}
              acceptedMessageRequest={contact.acceptedMessageRequest}
              avatarPath={contact.avatarPath}
              color={contact.color}
              firstName={contact.firstName}
              i18n={i18n}
              id={contact.id}
              isMe={contact.isMe}
              phoneNumber={contact.phoneNumber}
              profileName={contact.profileName}
              sharedGroupNames={contact.sharedGroupNames}
              title={contact.title}
              onClickRemove={() => toggleSelectedConversation(contact.id)}
            />
          ))}
        </ContactPills>
      ) : undefined}
      {candidateConversations.length ? (
        <Measure bounds>
          {({ contentRect, measureRef }: MeasuredComponentProps) => (
            <div
              className="StoriesSettingsModal__conversation-list"
              ref={measureRef}
            >
              <ConversationList
                dimensions={contentRect.bounds}
                getPreferredBadge={getPreferredBadge}
                getRow={getRow}
                i18n={i18n}
                onClickArchiveButton={shouldNeverBeCalled}
                onClickContactCheckbox={(conversationId: string) => {
                  toggleSelectedConversation(conversationId);
                }}
                lookupConversationWithoutUuid={asyncShouldNeverBeCalled}
                showConversation={shouldNeverBeCalled}
                showUserNotFoundModal={shouldNeverBeCalled}
                setIsFetchingUUID={shouldNeverBeCalled}
                onSelectConversation={shouldNeverBeCalled}
                renderMessageSearchResult={() => {
                  shouldNeverBeCalled();
                  return <div />;
                }}
                rowCount={rowCount}
                shouldRecomputeRowHeights={false}
                showChooseGroupMembers={shouldNeverBeCalled}
                theme={ThemeType.dark}
              />
            </div>
          )}
        </Measure>
      ) : (
        <div className="module-ForwardMessageModal__no-candidate-contacts">
          {i18n('noContactsFound')}
        </div>
      )}
    </ModalPage>
  );
};
