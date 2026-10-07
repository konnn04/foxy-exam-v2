FROM dunglas/frankenphp:1-php8.3-alpine

# Install PostgreSQL PDO and Redis extensions
RUN install-php-extensions \
    pdo_pgsql \
    pgsql \
    redis \
    bcmath \
    pcntl \
    zip \
    opcache

WORKDIR /app

# Copy application files
COPY . /app

# Install composer dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Set permissions
RUN chown -R www-data:www-data /app/storage /app/bootstrap/cache

# Environment
ENV SERVER_NAME=":8000"
EXPOSE 8000

CMD ["php", "artisan", "octane:frankenphp", "--host=0.0.0.0", "--port=8000"]
