import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from 'react-i18next';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "../../src/theme/ThemeContext";
import { useNotifications } from "./NotificationContext";
import type { PaymentNotification } from "./types/notification";

type NotificationFilter = "all" | "unread" | "incoming" | "outgoing";

export const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const { notifications, unreadCount, markAllRead, markRead, syncNow, isSyncing } =
    useNotifications();
  const { theme } = useTheme();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<NotificationFilter>("all");

  const openCenter = React.useCallback(() => {
    setOpen(true);
  }, []);

  const handleMarkAllRead = React.useCallback(() => {
    void markAllRead();
  }, [markAllRead]);

  const filteredNotifications = React.useMemo(
    () => notifications.filter((item) => {
      if (filter === "unread") return !item.read;
      if (filter === "incoming") return item.direction !== "outgoing";
      if (filter === "outgoing") return item.direction === "outgoing";
      return true;
    }),
    [filter, notifications],
  );

  const handleNotificationPress = React.useCallback((item: PaymentNotification) => {
    if (!item.read) void markRead(item.id);
    const transactionId = item.pagingToken ?? item.txHash;
    if (transactionId) {
      setOpen(false);
      router.push({ pathname: "/transaction/[id]", params: { id: transactionId } });
    }
  }, [markRead, router]);

  return (
    <>
      <Pressable style={styles.bell} onPress={openCenter}>
        <Ionicons
          name="notifications-outline"
          size={24}
          color={theme.textPrimary}
        />
        {unreadCount > 0 ? (
          <View
            style={[styles.badge, { backgroundColor: theme.status.error }]}
          >
            <Text
              style={[styles.badgeText, { color: theme.buttonDangerText }]}
            >
              {unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.modalHeader,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
            {t("notificationsTitle")}
          </Text>
          {unreadCount > 0 ? (
            <Pressable onPress={handleMarkAllRead}>
              <Text style={[styles.close, { color: theme.link }]}>
                {t("markAllRead", { defaultValue: "Mark all read" })}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setOpen(false)}>
              <Text style={[styles.close, { color: theme.link }]}>
                {t("close")}
              </Text>
            </Pressable>
          )}
        </View>
        <View
          style={[styles.filters, { backgroundColor: theme.background }]}
        >
          {(["all", "unread", "incoming", "outgoing"] as NotificationFilter[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              style={[styles.filter, { borderColor: theme.border }, filter === value && { backgroundColor: theme.primary }]}
            >
              <Text style={{ color: filter === value ? theme.buttonPrimaryText : theme.textSecondary }}>
                {value[0].toUpperCase() + value.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          style={{ backgroundColor: theme.background }}
          refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={() => void syncNow()} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleNotificationPress(item)}
              style={[
                styles.item,
                { borderColor: theme.borderLight },
                !item.read && { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                {item.direction === "outgoing" ? "Sent" : "Received"}{" "}
                {item.amount} {item.asset ?? ""}
              </Text>
              <Text
                style={[styles.itemSubtitle, { color: theme.textSecondary }]}
              >
                {item.direction === "outgoing" ? "To" : "From"}{" "}
                {item.sender ? shorten(item.sender) : "Unknown"} •{" "}
                {new Date(item.receivedAt).toLocaleString()}
              </Text>
              {item.memo ? (
                <Text style={[styles.itemMeta, { color: theme.textMuted }]}>
                  Memo: {item.memo}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                {filter === "all" ? t("noNotifications") : `No ${filter} notifications`}
              </Text>
            </View>
          )}
        />
      </Modal>
    </>
  );
};

function shorten(value: string) {
  if (!value) return "";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

const styles = StyleSheet.create({
  bell: { marginRight: 12 },
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    borderRadius: 9,
    minWidth: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  modalHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  close: {},
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filter: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  list: { padding: 16 },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemTitle: { fontWeight: "700" },
  itemSubtitle: { marginTop: 4 },
  itemMeta: { marginTop: 6, fontSize: 12 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: {},
});

export default NotificationCenter;
