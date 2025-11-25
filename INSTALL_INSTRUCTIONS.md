# Инструкции по установке на Ubuntu 24

## Проблема с правами доступа

Если вы получаете ошибку `Permission denied` при запуске через `sudo -u`, выполните следующие шаги:

### Вариант 1: Запуск от имени пользователя (рекомендуется)

```bash
# Переключитесь на пользователя fil
su - fil

# Перейдите в домашнюю директорию
cd ~

# Скачайте скрипт
curl -fsSL https://raw.githubusercontent.com/punk03/FTR_REG/main/install.sh -o install.sh

# Сделайте скрипт исполняемым
chmod +x install.sh

# Запустите скрипт
./install.sh
```

### Вариант 2: Использование bash напрямую

```bash
# От root выполните:
sudo -u fil bash -c 'cd ~ && curl -fsSL https://raw.githubusercontent.com/punk03/FTR_REG/main/install.sh -o install.sh && chmod +x install.sh && ./install.sh'
```

### Вариант 3: Клонирование репозитория

```bash
# От root выполните:
sudo -u fil bash -c 'cd ~ && git clone https://github.com/punk03/FTR_REG.git && cd FTR_REG && chmod +x install.sh && ./install.sh'
```

### Вариант 4: Исправление прав доступа

Если файл уже скачан, но не исполняемый:

```bash
# От root:
chmod +x /path/to/install.sh
chown fil:fil /path/to/install.sh

# Затем запустите:
sudo -u fil /path/to/install.sh
```

## Проверка прав доступа

Проверьте права на файл:
```bash
ls -l install.sh
```

Должно быть что-то вроде:
```
-rwxr-xr-x 1 fil fil 12345 Nov 25 12:00 install.sh
```

Если видите `-rw-r--r--` (нет `x`), выполните:
```bash
chmod +x install.sh
```

## Проверка файловой системы

Если проблема сохраняется, возможно файловая система смонтирована с `noexec`. Проверьте:

```bash
mount | grep $(df . | tail -1 | awk '{print $1}')
```

Если видите `noexec`, нужно либо:
1. Переместить скрипт на другую файловую систему
2. Использовать `bash install.sh` вместо `./install.sh`
