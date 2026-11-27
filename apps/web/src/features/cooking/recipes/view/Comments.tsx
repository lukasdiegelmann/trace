import {
  Avatar,
  Button,
  Chip,
  Input,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirm } from "../../common/useConfirm";
import { useLoad } from "../../common/useLoad";
import { useNotify } from "../../common/useNotify";
import { assetUrl } from "../../lib/assetUrl";
import { commentThreads, VISIBLE_THREADS } from "../../lib/commentThreads";
import { relativeTime } from "../../lib/relativeTime";
import { markupToRichText, richTextToMarkup } from "../../lib/richText";
import {
  addComment,
  deleteComment,
  editComment,
  getComments,
  type RecipeComment,
} from "../../recipesApi";

import { RichText } from "./RichText";

interface EditorProps {
  initial?: string;
  placeholder: string;
  submitText: string;
  onSubmit: (html: string) => Promise<boolean>;
  onCancel?: () => void;
}

function CommentEditor({
  initial = "",
  placeholder,
  submitText,
  onSubmit,
  onCancel,
}: EditorProps) {
  const { t } = useTranslation("cooking");
  const [text, setText] = useState(initial);
  const [isBusy, setIsBusy] = useState(false);
  const html = markupToRichText(text);

  const submit = async () => {
    setIsBusy(true);
    if (await onSubmit(html)) setText("");
    setIsBusy(false);
  };

  return (
    <Stack gap={2}>
      <Input
        multiline
        rows={3}
        aria-label={placeholder}
        placeholder={placeholder}
        value={text}
        onValueChange={setText}
      />
      <Row justify="between" align="center" gap={2} shouldWrap>
        <Text variant="caption" tone="muted">
          {t("recipeCommon.markupHint")}
        </Text>
        <Row gap={2}>
          {onCancel ? (
            <Button
              variant="ghost"
              size="sm"
              text={t("cookingCommon.cancel")}
              onClick={onCancel}
            />
          ) : null}
          <Button
            variant="primary"
            size="sm"
            text={submitText}
            isLoading={isBusy}
            isDisabled={!html}
            onClick={() => void submit()}
          />
        </Row>
      </Row>
    </Stack>
  );
}

export interface CommentsProps {
  recipeId: number;
  userId: number | null;
  isAdmin: boolean;
  canPost: boolean;
}

export function Comments({
  recipeId,
  userId,
  isAdmin,
  canPost,
}: CommentsProps) {
  const { t, i18n } = useTranslation("cooking");
  const notify = useNotify();
  const { confirm, dialog } = useConfirm();
  const { data, reload } = useLoad(
    useCallback(() => getComments(recipeId), [recipeId]),
  );
  const comments = data ?? [];
  const threads = commentThreads(comments);
  const [shouldShowAll, setShouldShowAll] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const visible = shouldShowAll ? threads : threads.slice(-VISIBLE_THREADS);

  const attempt = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await reload({ isQuiet: true });
      return true;
    } catch (caught) {
      notify.failure(caught, t("recipeView.comments.failed"));
      return false;
    }
  };

  const remove = async (comment: RecipeComment) => {
    const isConfirmed = await confirm({
      title: t("recipeView.comments.deleteTitle"),
      message: t("recipeView.comments.deleteMessage"),
      confirmText: t("cookingCommon.delete"),
      isDangerous: true,
    });
    if (isConfirmed) {
      await attempt(() => deleteComment(recipeId, comment.id));
    }
  };

  const view = (comment: RecipeComment, isReply: boolean) => {
    const name =
      comment.created_by_full_name ||
      comment.created_by_username ||
      t("recipeView.comments.anonymous");
    const canChange =
      isAdmin || (userId !== null && comment.user_id === userId);
    return (
      <Stack gap={1} key={comment.id}>
        <Row gap={2} align="center" shouldWrap>
          <Avatar
            src={assetUrl(comment.created_by_avatar_url) || null}
            name={name}
            size={isReply ? 24 : 32}
          />
          <Text variant="small">{name}</Text>
          <Text variant="caption" tone="muted" title={comment.created_at}>
            {relativeTime(comment.created_at, i18n.language)}
            {comment.updated_at !== comment.created_at
              ? ` ${t("recipeView.comments.edited")}`
              : ""}
          </Text>
        </Row>
        {editing === comment.id ? (
          <CommentEditor
            initial={richTextToMarkup(comment.body)}
            placeholder={t("recipeView.comments.edit")}
            submitText={t("cookingCommon.save")}
            onCancel={() => {
              setEditing(null);
            }}
            onSubmit={async (html) => {
              const isSaved = await attempt(() =>
                editComment(recipeId, comment.id, html),
              );
              if (isSaved) {
                setEditing(null);
                notify.info(t("recipeView.comments.updated"));
              }
              return isSaved;
            }}
          />
        ) : (
          <>
            <RichText html={comment.body} />
            <Row gap={1}>
              {!isReply && canPost ? (
                <Button
                  variant="ghost"
                  size="sm"
                  text={t("recipeView.comments.reply")}
                  onClick={() => {
                    setReplyTo(comment.id);
                  }}
                />
              ) : null}
              {canChange ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("cookingCommon.edit")}
                    onClick={() => {
                      setEditing(comment.id);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("cookingCommon.delete")}
                    onClick={() => void remove(comment)}
                  />
                </>
              ) : null}
            </Row>
          </>
        )}
      </Stack>
    );
  };

  return (
    <Stack gap={3} as="section" className="print:hidden">
      <Row gap={2} align="center">
        <Text variant="heading" as="h2">
          {t("recipeView.comments.title")}
        </Text>
        {comments.length > 0 ? <Chip text={String(comments.length)} /> : null}
      </Row>
      {!data ? <Spinner label={t("cookingCommon.loading")} /> : null}
      {data && threads.length === 0 ? (
        <Text tone="muted">{t("recipeView.comments.none")}</Text>
      ) : null}
      {threads.length > visible.length ? (
        <Button
          variant="ghost"
          size="sm"
          text={t("recipeView.comments.showAll", { count: threads.length })}
          onClick={() => {
            setShouldShowAll(true);
          }}
        />
      ) : null}
      {visible.map((thread) => (
        <Stack
          gap={2}
          key={thread.root.id}
          className="rounded-container border border-border bg-level-1 p-3"
        >
          {view(thread.root, false)}
          {thread.replies.length > 0 || replyTo === thread.root.id ? (
            <div className="flex flex-col gap-3 border-l-2 border-border pl-3">
              {thread.replies.map((reply) => view(reply, true))}
              {replyTo === thread.root.id ? (
                <CommentEditor
                  placeholder={t("recipeView.comments.replyPlaceholder")}
                  submitText={t("recipeView.comments.postReply")}
                  onCancel={() => {
                    setReplyTo(null);
                  }}
                  onSubmit={async (html) => {
                    const isPosted = await attempt(() =>
                      addComment(recipeId, html, thread.root.id),
                    );
                    if (isPosted) setReplyTo(null);
                    return isPosted;
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </Stack>
      ))}
      {canPost ? (
        <CommentEditor
          placeholder={t("recipeView.comments.placeholder")}
          submitText={t("recipeView.comments.post")}
          onSubmit={async (html) => {
            const isPosted = await attempt(() =>
              addComment(recipeId, html, null),
            );
            if (isPosted) setShouldShowAll(true);
            return isPosted;
          }}
        />
      ) : null}
      {dialog}
    </Stack>
  );
}
