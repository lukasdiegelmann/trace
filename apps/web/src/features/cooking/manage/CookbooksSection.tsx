import {
  Button,
  Checkbox,
  Chip,
  FileInput,
  InplaceMultiSelect,
  Input,
  MultiSelect,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { BookOpen, ImageOff, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ErrorState, LoadingState } from "../common/states";
import { useLoad } from "../common/useLoad";
import { useNotify } from "../common/useNotify";
import { assetUrl } from "../lib/assetUrl";
import { filterByName } from "../lib/manage";
import {
  manageApi,
  type CookbookSummary,
  type SmartFilter,
} from "../manageApi";
import { uploadImage } from "../uploads";
import {
  EditDeleteButtons,
  ManageRow,
  MoveButtons,
  SaveCancelButtons,
  SectionHead,
} from "./parts";
import { useCrudList } from "./useCrudList";

const ANY = "any";

function Cover({ url }: { url: string | null }) {
  return url ? (
    <img src={assetUrl(url)} alt="" className="size-full object-cover" />
  ) : (
    <BookOpen aria-hidden size={20} />
  );
}

/** The new smart cookbook's filter, evaluated on every open */
function SmartFilterFields({
  categoryId,
  tags,
  isFavoritesOnly,
  onCategory,
  onTags,
  onFavoritesOnly,
}: {
  categoryId: string;
  tags: string[];
  isFavoritesOnly: boolean;
  onCategory: (id: string) => void;
  onTags: (tags: string[]) => void;
  onFavoritesOnly: (isOn: boolean) => void;
}) {
  const { t } = useTranslation("cooking");
  const load = useCallback(async () => {
    const [categories, known] = await Promise.all([
      manageApi.recipeCategories().catch(() => []),
      manageApi.taxonomy("tags").catch(() => []),
    ]);
    return { categories, tags: known.map((tag) => tag.name) };
  }, []);
  const { data } = useLoad(load);
  const options = [...new Set([...(data?.tags ?? []), ...tags])];
  return (
    <Stack gap={2}>
      <Text variant="small" tone="muted">
        {t("manage.cookbooks.smartHelp")}
      </Text>
      <InplaceMultiSelect
        label={t("manage.cookbooks.category")}
        value={categoryId}
        options={[
          { value: ANY, label: t("manage.cookbooks.anyCategory") },
          ...(data?.categories ?? []).map((category) => ({
            value: String(category.id),
            label: category.name,
          })),
        ]}
        onChange={onCategory}
      />
      <MultiSelect
        name="smart-tags"
        label={t("manage.cookbooks.tags")}
        placeholder={t("manage.cookbooks.tagsPlaceholder")}
        value={tags}
        onChange={onTags}
        options={options.map((tag) => ({ value: tag, label: tag }))}
        addOptionButtonLabel={t("manage.cookbooks.addTag")}
        onAddOption={(query) => {
          const tag = query.trim();
          if (tag && !tags.includes(tag)) onTags([...tags, tag]);
        }}
      />
      <Checkbox
        checked={isFavoritesOnly}
        label={t("manage.cookbooks.favoritesOnly")}
        onChange={onFavoritesOnly}
      />
    </Stack>
  );
}

interface Edit {
  item: CookbookSummary;
  name: string;
  description: string;
  cover: string;
}

/** The cookbook catalog; contents are edited on the cookbook's page */
export function CookbooksSection() {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const navigate = useNavigate();
  const list = useCrudList<CookbookSummary>(manageApi.cookbooks);
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSmart, setIsSmart] = useState(false);
  const [categoryId, setCategoryId] = useState(ANY);
  const [tags, setTags] = useState<string[]>([]);
  const [isFavoritesOnly, setIsFavoritesOnly] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const items = list.items ?? [];
  const shown = filterByName(items, filter);
  const open = (item: CookbookSummary) =>
    void navigate(`/cooking/cookbooks/${item.id}`);

  const create = async () => {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    await list.run(async () => {
      const smartFilter: SmartFilter = {
        ...(categoryId === ANY ? {} : { category_id: Number(categoryId) }),
        ...(tags.length > 0 ? { tags } : {}),
        ...(isFavoritesOnly ? { favorites_only: true } : {}),
      };
      const created = await manageApi.createCookbook({
        name: name.trim(),
        description: description.trim() || null,
        is_smart: isSmart,
        ...(isSmart ? { smart_filter: smartFilter } : {}),
      });
      list.setData((all) => [
        ...all,
        { ...created, recipe_count: created.recipe_count ?? 0 },
      ]);
      setName("");
      setDescription("");
      setIsSmart(false);
      setCategoryId(ANY);
      setTags([]);
      setIsFavoritesOnly(false);
      notify.success(t("manage.cookbooks.created"));
    }, t("manage.toast.addFailed"));
    setIsCreating(false);
  };

  const save = async () => {
    if (!edit?.name.trim()) return;
    await list.run(async () => {
      const updated = await manageApi.updateCookbook(edit.item.id, {
        name: edit.name.trim(),
        description: edit.description.trim() || null,
        cover_image_url: edit.cover || null,
        _base: edit.item,
      });
      list.setData((all) =>
        all.map((entry) =>
          entry.id === updated.id ? { ...entry, ...updated } : entry,
        ),
      );
      setEdit(null);
      notify.success(t("manage.toast.saved"));
    }, t("manage.toast.saveFailed"));
  };

  const uploadCover = async (file: File) => {
    setIsUploading(true);
    try {
      const cover = await uploadImage(file, file.name);
      setEdit((current) => (current ? { ...current, cover } : current));
    } catch (caught) {
      notify.failure(caught, t("cookingCommon.photo.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Stack gap={3}>
      <SectionHead
        title={t("manage.sections.cookbooks.label")}
        text={t("manage.cookbooks.description")}
      />
      {list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : !list.items ? (
        <LoadingState />
      ) : (
        <>
          {items.length === 0 ? (
            <Text tone="muted">{t("manage.cookbooks.empty")}</Text>
          ) : (
            <Input
              type="search"
              label={t("cookingCommon.filter")}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
              }}
            />
          )}
          {items.length > 0 && shown.length === 0 ? (
            <Text tone="muted">{t("manage.noMatch", { query: filter })}</Text>
          ) : null}
          <Stack gap={2} as="ul">
            {shown.map((item) => (
              <ManageRow key={item.id}>
                {edit?.item.id === item.id ? (
                  <Stack gap={2} fill="width">
                    <Row gap={3} align="center" shouldWrap>
                      <span className="flex size-16 items-center justify-center overflow-hidden rounded-control bg-level-3">
                        <Cover url={edit.cover} />
                      </span>
                      <FileInput
                        accept="image/*"
                        text={t("manage.cookbooks.uploadCover")}
                        placeholder={
                          isUploading
                            ? t("cookingCommon.photo.uploading")
                            : t("cookingCommon.photo.noFile")
                        }
                        disabled={isUploading}
                        file={null}
                        onChange={(file) => {
                          if (file) void uploadCover(file);
                        }}
                      />
                      {edit.cover ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          text={t("manage.cookbooks.removeCover")}
                          onClick={() => {
                            setEdit({ ...edit, cover: "" });
                          }}
                        >
                          <ImageOff aria-hidden size={14} />
                        </Button>
                      ) : null}
                    </Row>
                    <Input
                      label={t("manage.name")}
                      value={edit.name}
                      onChange={(event) => {
                        setEdit({ ...edit, name: event.target.value });
                      }}
                      onEnter={() => void save()}
                    />
                    <Input
                      label={t("manage.cookbooks.descriptionField")}
                      value={edit.description}
                      onChange={(event) => {
                        setEdit({ ...edit, description: event.target.value });
                      }}
                      onEnter={() => void save()}
                    />
                    <SaveCancelButtons
                      canSave={Boolean(edit.name.trim()) && !isUploading}
                      onSave={() => void save()}
                      onCancel={() => {
                        setEdit(null);
                      }}
                    />
                  </Stack>
                ) : (
                  <>
                    <MoveButtons
                      name={item.name}
                      index={items.findIndex((entry) => entry.id === item.id)}
                      count={items.length}
                      onMove={(delta) =>
                        void list.move(
                          item.id,
                          delta,
                          manageApi.reorderCookbooks,
                        )
                      }
                    />
                    <Pressable
                      label={t("manage.cookbooks.open", { name: item.name })}
                      onPress={() => {
                        open(item);
                      }}
                      className="flex min-w-0 flex-1 flex-row items-center justify-start gap-3 text-start"
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control bg-level-3">
                        <Cover url={item.cover_image_url} />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <Text as="span">
                          <strong>{item.name}</strong>
                        </Text>
                        {item.description ? (
                          <Text as="span" variant="small" tone="muted">
                            {item.description}
                          </Text>
                        ) : null}
                        <Text as="span" variant="caption" tone="muted">
                          {t("manage.recipeCount", {
                            count: item.recipe_count ?? 0,
                          })}
                        </Text>
                      </span>
                    </Pressable>
                    {item.is_smart ? (
                      <Chip tone="accent" text={t("manage.cookbooks.smart")} />
                    ) : null}
                    <EditDeleteButtons
                      name={item.name}
                      onEdit={() => {
                        setEdit({
                          item,
                          name: item.name,
                          description: item.description ?? "",
                          cover: item.cover_image_url ?? "",
                        });
                      }}
                      onDelete={() =>
                        void list.remove(
                          item,
                          {
                            title: t("manage.confirmDelete", {
                              name: item.name,
                            }),
                            message: t("manage.cookbooks.deleteMessage", {
                              count: item.recipe_count ?? 0,
                            }),
                          },
                          () => manageApi.removeCookbook(item.id),
                        )
                      }
                    />
                  </>
                )}
              </ManageRow>
            ))}
          </Stack>
          <Stack gap={2}>
            <Row gap={2} align="end" shouldWrap>
              <Input
                label={t("manage.cookbooks.newName")}
                value={name}
                wrapperClassName="min-w-40 flex-1"
                onChange={(event) => {
                  setName(event.target.value);
                }}
                onEnter={() => void create()}
              />
              <Input
                label={t("manage.cookbooks.descriptionField")}
                value={description}
                wrapperClassName="min-w-40 flex-1"
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
                onEnter={() => void create()}
              />
            </Row>
            <Checkbox
              checked={isSmart}
              label={t("manage.cookbooks.makeSmart")}
              onChange={setIsSmart}
            />
            {isSmart ? (
              <SmartFilterFields
                categoryId={categoryId}
                tags={tags}
                isFavoritesOnly={isFavoritesOnly}
                onCategory={setCategoryId}
                onTags={setTags}
                onFavoritesOnly={setIsFavoritesOnly}
              />
            ) : null}
            <Button
              size="md"
              variant="primary"
              text={t("manage.cookbooks.add")}
              isDisabled={!name.trim() || isCreating}
              onClick={() => void create()}
            >
              <Plus aria-hidden size={16} />
            </Button>
          </Stack>
        </>
      )}
      {list.dialog}
    </Stack>
  );
}
